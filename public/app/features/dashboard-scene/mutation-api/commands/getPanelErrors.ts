import type * as z from 'zod';

import { LoadingState } from '@grafana/data';

import { getElements } from '../../serialization/layoutSerializers/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils-panels';
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
    const fullElements = getElements(scene.state.body, scene);
    const panels = scene.state.body.getVizPanels();
    const data: PanelErrorsData = {
      errors: [],
      noDataPanels: [],
      panelsChecked: 0,
      panelsWithoutQueries: 0,
      uncheckedPanels: [],
    };
    for (const name of new Set(elements ?? Object.keys(fullElements))) {
      const element = fullElements[name];
      if (!element) {
        data.uncheckedPanels.push({ element: name, reason: 'not_found' });
        continue;
      }
      const id = scene.serializer.getPanelIdForElement(name);
      const panel = id === undefined ? undefined : panels.find((p) => p.state.key === getVizPanelKeyForPanelId(id));
      const status = panel && getPanelRuntimeStatus(panel);
      if (!status) {
        if (element.kind === 'Panel' && element.spec.data.spec.queries.length === 0) {
          data.panelsWithoutQueries += 1;
        } else {
          data.uncheckedPanels.push({ element: name, reason: 'status_unavailable' });
        }
        continue;
      }
      if ([LoadingState.Loading, LoadingState.Streaming, LoadingState.NotStarted].includes(status.loadingState)) {
        data.uncheckedPanels.push({ element: name, reason: 'loading' });
        continue;
      }
      data.panelsChecked += 1;
      const identity = { element: name, title: panel?.state.title ?? '' };
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
