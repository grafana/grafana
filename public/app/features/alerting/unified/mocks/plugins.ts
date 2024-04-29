import { http, HttpResponse } from 'msw';

import { PluginMeta } from '@grafana/data';
import { getMockPluginMeta } from 'app/features/alerting/unified/mocks';

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
