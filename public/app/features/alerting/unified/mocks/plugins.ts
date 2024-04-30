import { http, HttpResponse } from 'msw';

import { PluginMeta } from '@grafana/data';

export const pluginsHandler = (pluginsRegistry: Map<string, PluginMeta>) =>
  http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) =>
    pluginsRegistry.has(pluginId)
      ? HttpResponse.json<PluginMeta>(pluginsRegistry.get(pluginId)!)
      : HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 })
  );
