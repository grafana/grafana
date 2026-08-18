import { type DataTransformerConfig } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { SceneDataTransformer } from '@grafana/scenes';

import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getPanelIdForVizPanel } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';

export const TRANSFORMATIONS_URL_PARAM = 'transformations';

/** Targets all panels on the dashboard */
const ALL_PANELS = '*';

interface UrlTransformations {
  prepend: DataTransformerConfig[];
  append: DataTransformerConfig[];
}

const EMPTY: UrlTransformations = { prepend: [], append: [] };

/**
 * Dashboard behavior that applies transformations provided through the `transformations` URL parameter.
 * They are combined with (never replace) user configured transformations, show up as read-only rows in
 * the panel editor and are never persisted.
 *
 * Supported shapes (URL encoded JSON):
 * - `[{"id":"reduce","options":{}}]` - appended to every panel
 * - `{"3":{"prepend":[...],"append":[...]}}` - keyed by panel id
 * - `{"3":[...]}` - shorthand, appended to panel 3
 */
export function syncTransformationsFromUrl(scene: DashboardScene) {
  const apply = () => {
    const raw = locationService.getSearch().get(TRANSFORMATIONS_URL_PARAM);
    const byPanel = parseTransformationsParam(raw);

    for (const panel of dashboardSceneGraph.getVizPanels(scene)) {
      const provider = panel.state.$data;

      if (!(provider instanceof SceneDataTransformer)) {
        continue;
      }

      // Always apply - an empty update clears previous url transformations when the param goes away
      const transformations = byPanel.get(String(getPanelIdForVizPanel(panel))) ?? byPanel.get(ALL_PANELS) ?? EMPTY;
      provider.setSystemTransformations({ ...transformations, origin: 'url' });
    }
  };

  apply();

  const unlisten = locationService.getHistory().listen(() => apply());

  return () => unlisten();
}

function parseTransformationsParam(raw: string | null): Map<string, UrlTransformations> {
  const byPanel = new Map<string, UrlTransformations>();

  if (!raw) {
    return byPanel;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(`Ignoring invalid ${TRANSFORMATIONS_URL_PARAM} URL parameter`, err);
    return byPanel;
  }

  if (Array.isArray(parsed)) {
    byPanel.set(ALL_PANELS, toUrlTransformations(parsed));
    return byPanel;
  }

  if (parsed !== null && typeof parsed === 'object') {
    for (const [panelId, value] of Object.entries(parsed)) {
      byPanel.set(panelId, toUrlTransformations(value));
    }
  }

  return byPanel;
}

function toUrlTransformations(value: unknown): UrlTransformations {
  if (Array.isArray(value)) {
    return { prepend: [], append: value.filter(isTransformerConfig) };
  }

  if (value !== null && typeof value === 'object') {
    return {
      prepend: 'prepend' in value && Array.isArray(value.prepend) ? value.prepend.filter(isTransformerConfig) : [],
      append: 'append' in value && Array.isArray(value.append) ? value.append.filter(isTransformerConfig) : [],
    };
  }

  return EMPTY;
}

function isTransformerConfig(value: unknown): value is DataTransformerConfig {
  return value !== null && typeof value === 'object' && 'id' in value && typeof value.id === 'string';
}
