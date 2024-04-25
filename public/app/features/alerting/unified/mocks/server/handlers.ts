/**
 * Contains definitions for all handlers that are required for test rendering of components within Alerting
 */

import { HttpResponse, http } from 'msw';

import { PluginMeta } from '@grafana/data';
import { getMockPluginMeta, mockFolder } from 'app/features/alerting/unified/mocks';
import { defaultAlertmanagerChoiceResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';

export const alertmanagerChoiceHandler = (response = defaultAlertmanagerChoiceResponse) =>
  http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export const folderHandler = (response = mockFolder()) =>
  http.get(`/api/folders/:folderUid`, () => HttpResponse.json(response));

export const pluginSettingsHandler = () =>
  http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params }) => {
    const { pluginId } = params;
    const mockedPlugins: Record<string, PluginMeta> = {
      'grafana-incident-app': getMockPluginMeta(pluginId, 'Grafana Incident'),
    };

    const pluginMeta = mockedPlugins[pluginId];
    if (pluginMeta) {
      return HttpResponse.json(pluginMeta);
    }

    return HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 });
  });

/**
 * All mock handlers that are required across Alerting tests
 */
const allHandlers = [alertmanagerChoiceHandler(), folderHandler(), pluginSettingsHandler()];

export default allHandlers;
