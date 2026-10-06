import type * as z from 'zod';

import { LoadingState } from '@grafana/data';

import { getPanelIdForVizPanel } from '../../utils/utils-panels';
import type { PanelErrorsData } from '../types';

import { getPanelRuntimeStatus } from './listPanels';
import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const getPanelErrorsCommand: MutationCommand<z.infer<typeof payloads.getPanelErrors>> = {
  name: 'GET_PANEL_ERRORS',
  description: payloads.getPanelErrors.description ?? '',
  payloadSchema: payloads.getPanelErrors,
  permission: readOnly,
  readOnly: true,
  handler: async ({ elements }, { scene }) => {
    const panelsByElement = new Map(
      scene.state.body
        .getVizPanels()
        .map((panel) => [scene.serializer.getElementIdForPanel(getPanelIdForVizPanel(panel)), panel])
    );
    const data: PanelErrorsData = {
      errors: [],
      noDataPanels: [],
      panelsChecked: 0,
      uncheckedPanels: [],
    };
    for (const name of new Set(elements ?? panelsByElement.keys())) {
      if (name === undefined) {
        continue;
      }
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
        data.uncheckedPanels.push({ element: name, reason: 'loading' });
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
    return { success: true, data, changes: [] };
  },
};
