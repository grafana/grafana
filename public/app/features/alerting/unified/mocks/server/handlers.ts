/**
 * Contains definitions for all handlers that are required for test rendering of components within Alerting
 */

import { HttpResponse, http } from 'msw';

import { PluginMeta } from '@grafana/data';
import { defaultAlertmanagerChoiceResponse } from 'app/features/alerting/unified/mocks/alertmanagerApi';

export const alertmanagerChoiceHandler = (response = defaultAlertmanagerChoiceResponse) =>
  http.get('/api/v1/ngalert', () => HttpResponse.json(response));

export const pluginsHandler = (pluginsRegistry: Map<string, PluginMeta>) =>
  http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) =>
    pluginsRegistry.has(pluginId)
      ? HttpResponse.json<PluginMeta>(pluginsRegistry.get(pluginId)!)
      : HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 })
  );
