import {
  type DashboardDataEvent,
  type DashboardDataService,
  type DashboardInfo,
  type DashboardPanelCapture,
  type DashboardPanelCaptureRequest,
  type DashboardPanelInfo,
  type DashboardSourceResolution,
  type DashboardVariableInfo,
  type DashboardVariableOption,
  locationService,
} from '@grafana/runtime';
import {
  MultiValueVariable,
  SceneObjectStateChangedEvent,
  sceneGraph,
  type VariableValueOption,
} from '@grafana/scenes';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { isDashboardSceneLike, type DashboardSceneLike } from '../scene/types/dashboard';
import { findVizPanelByKey } from '../utils/findVizPanel';
import { getDashboardUrl } from '../utils/getDashboardUrl';

import { capturePanels, getVariableValues, toSectionInfo } from './capture';
import { dashboardDeactivations } from './lifecycle';
import { getVizPanelExploreUrl, revealVizPanel } from './navigation';
import { ALL_PANELS_REF, parseSectionRef, resolveSourceRefs } from './sections';
import { getSourcePanels } from './sources';

/** State changes that can change what a capture or the panel list returns. */
const CHANGE_KEYS = [
  'data',
  'value',
  'text',
  'filters',
  'title',
  'description',
  'body',
  'children',
  'tabs',
  'rows',
  'isCollapsed',
];

function getCurrentDashboard(): DashboardSceneLike | undefined {
  const scene = window.__grafanaSceneContext;
  return isDashboardSceneLike(scene) && scene.isActive ? scene : undefined;
}

export class DashboardDataServiceImpl implements DashboardDataService {
  public getDashboard(): DashboardInfo | undefined {
    const dashboard = getCurrentDashboard();
    if (!dashboard) {
      return undefined;
    }
    const { key, uid, title, description, meta, isEditing } = dashboard.state;
    const range = sceneGraph.getTimeRange(dashboard).state.value;
    return {
      instanceKey: key ?? '',
      uid: uid || undefined,
      title,
      description: description ?? '',
      url: getDashboardUrl({
        uid,
        slug: meta.slug,
        currentQueryParams: locationService.getLocation().search,
        // Editing and inspection state is not part of what the dashboard shows.
        updateQuery: { editPanel: null, viewPanel: null, editview: null, inspect: null, inspectTab: null },
        absolute: true,
      }),
      canEdit: Boolean(meta.canEdit),
      isEditing: Boolean(isEditing),
      timeRange: { from: range.from.toISOString(), to: range.to.toISOString() },
      variables: getVariableValues(dashboard),
      allPanelsRef: ALL_PANELS_REF,
    };
  }

  public getPanels(): DashboardPanelInfo[] {
    const dashboard = getCurrentDashboard();
    return dashboard
      ? getSourcePanels(dashboard).map((source) => ({
          key: source.key,
          title: source.title,
          description: source.description,
          pluginId: source.pluginId,
          sections: toSectionInfo(source),
        }))
      : [];
  }

  public getVariables(): DashboardVariableInfo[] {
    const dashboard = getCurrentDashboard();
    if (!dashboard) {
      return [];
    }
    return (sceneGraph.getVariables(dashboard)?.state.variables ?? []).flatMap((variable) => {
      if (!(variable instanceof MultiValueVariable)) {
        return [];
      }
      const { name, label, options, value } = variable.state;
      const values = (Array.isArray(value) ? value : [value]).map(String).filter((item) => item !== '');
      const isAll = values.includes(ALL_VARIABLE_VALUE);
      const all: DashboardVariableOption[] = options.map((option: VariableValueOption) => ({
        value: String(option.value),
        text: option.label,
      }));
      return [
        {
          name,
          label: label || undefined,
          isAll,
          options: all,
          selected: isAll ? [] : all.filter((option) => values.includes(option.value)),
        },
      ];
    });
  }

  public resolveSources(refs: string[]): DashboardSourceResolution {
    const dashboard = getCurrentDashboard();
    return dashboard
      ? resolveSourceRefs(refs, getSourcePanels(dashboard))
      : { panelKeys: [], unavailable: refs.map((ref) => ({ ref, sectionPath: parseSectionRef(ref) })) };
  }

  public capturePanels(request: DashboardPanelCaptureRequest): Promise<DashboardPanelCapture> {
    const dashboard = getCurrentDashboard();
    return dashboard ? capturePanels(dashboard, request) : Promise.reject(new Error('No dashboard is open.'));
  }

  public revealPanel(panelKey: string): void {
    const dashboard = getCurrentDashboard();
    const panel = dashboard && findVizPanelByKey(dashboard, panelKey);
    if (panel) {
      revealVizPanel(panel);
    }
  }

  public getExploreUrl(panelKey: string, timeWindow: { from: string; to: string }): Promise<string | undefined> {
    const dashboard = getCurrentDashboard();
    const panel = dashboard && findVizPanelByKey(dashboard, panelKey);
    return panel ? getVizPanelExploreUrl(panel, timeWindow) : Promise.resolve(undefined);
  }

  public subscribe(listener: (event: DashboardDataEvent) => void): () => void {
    const dashboard = getCurrentDashboard();
    if (!dashboard) {
      return () => {};
    }
    const instanceKey = dashboard.state.key ?? '';
    let frame: number | undefined;
    // A refresh touches many panels at once, so changes are reported once per frame.
    const changes = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, ({ payload }) => {
      if (frame !== undefined || !CHANGE_KEYS.some((key) => key in payload.partialUpdate)) {
        return;
      }
      frame = requestAnimationFrame(() => {
        frame = undefined;
        listener({ type: 'changed' });
      });
    });
    const deactivations = dashboardDeactivations.subscribe((key) => {
      if (key === instanceKey) {
        listener({ type: 'deactivated', instanceKey });
      }
    });
    return () => {
      changes.unsubscribe();
      deactivations.unsubscribe();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }
}
