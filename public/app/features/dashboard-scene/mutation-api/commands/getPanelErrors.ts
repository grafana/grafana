import type * as z from 'zod';

import { LoadingState } from '@grafana/data';
import { SceneGridRow, type VizPanel } from '@grafana/scenes';

import { RowItem } from '../../scene/layout-rows/RowItem';
import { TabItem } from '../../scene/layout-tabs/TabItem';
import { getQueryRunnerFor } from '../../utils/getQueryRunnerFor';
import { getPanelIdForVizPanel, getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import type { PanelErrorsData } from '../types';

import { getPanelRuntimeStatus } from './listPanels';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

const WAIT_POLL_INTERVAL_MS = 100;

export const getPanelErrorsCommand: MutationCommand<z.infer<typeof payloads.getPanelErrors>> = {
  name: 'GET_PANEL_ERRORS',
  description: payloads.getPanelErrors.description ?? '',
  payloadSchema: payloads.getPanelErrors,
  permission: readOnly,
  readOnly: true,
  handler: async ({ elements, waitMs = 0 }, context) => {
    const { scene } = context;
    const elementByPanelId = new Map(Array.from(scene.serializer.getElementPanelMapping(), ([name, id]) => [id, name]));
    const panelsByElement = new Map(
      scene.state.body.getVizPanels().map((panel) => {
        const id = getPanelIdForVizPanel(panel);
        // Unmapped runtime panels use the serializer's generated naming convention.
        const name = elementByPanelId.get(id) ?? getVizPanelKeyForPanelId(id);
        return [name, panel];
      })
    );
    const data: PanelErrorsData = {
      errors: [],
      noDataPanels: [],
      panelsChecked: 0,
      uncheckedPanels: [],
    };
    for (const name of new Set(elements ?? panelsByElement.keys())) {
      const panel = panelsByElement.get(name);
      if (!panel) {
        data.uncheckedPanels.push({ element: name, reason: 'not_found' });
        continue;
      }
      const status = getPanelRuntimeStatus(panel);
      if (!status) {
        data.uncheckedPanels.push({ element: name, reason: 'status_unavailable' });
        continue;
      }
      if ([LoadingState.Loading, LoadingState.Streaming, LoadingState.NotStarted].includes(status.loadingState)) {
        const detail = getNotRenderedDetail(panel);
        data.uncheckedPanels.push(
          detail ? { element: name, reason: 'not_rendered', detail } : { element: name, reason: 'loading' }
        );
        continue;
      }
      data.panelsChecked += 1;
      const identity = { element: name, title: panel.state.title ?? '' };
      if (status.hasError) {
        data.errors.push({
          ...identity,
          errors: status.errors?.length
            ? status.errors
            : [
                {
                  source: 'query',
                  // This diagnostic is returned to API consumers rather than rendered in the UI.
                  // eslint-disable-next-line @grafana/i18n/no-untranslated-strings
                  message: 'Panel reported an error without an error message.',
                },
              ],
        });
      } else if (status.hasNoData) {
        data.noDataPanels.push(identity);
      }
    }
    if (waitMs > 0 && data.uncheckedPanels.some(({ reason }) => reason === 'loading')) {
      const delay = Math.min(waitMs, WAIT_POLL_INTERVAL_MS);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return getPanelErrorsCommand.handler({ elements, waitMs: waitMs - delay }, context);
    }
    return { success: true, data, changes: [] };
  },
};

/** Why a panel cannot load until the user shows it, if it is in a hidden tab, a collapsed row or out of view. */
function getNotRenderedDetail(panel: VizPanel): string | undefined {
  for (let parent = panel.parent; parent; parent = parent.parent) {
    // Matches what the tabs renderer shows, which falls back to the first tab when none is selected.
    if (parent instanceof TabItem && parent.getParentLayout().getCurrentTab() !== parent) {
      return 'inactive tab';
    }
    if (
      (parent instanceof RowItem && parent.getCollapsedState()) ||
      (parent instanceof SceneGridRow && parent.state.isCollapsed)
    ) {
      return 'collapsed row';
    }
  }
  // Lazy dashboards run a panel's queries once it is near the viewport. Scenes has no public getter for this.
  return panel.isActive && getQueryRunnerFor(panel)?.['_queryNotExecutedWhenOutOfView'] === true
    ? 'out of view'
    : undefined;
}
