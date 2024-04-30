import { http, HttpResponse } from 'msw';

import { PluginMeta } from '@grafana/data';
import { plugins } from 'app/features/alerting/unified/testSetup/plugins';

export const pluginsHandler = (pluginsRegistry: Record<string, PluginMeta> = plugins) =>
  http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) =>
    pluginsRegistry[pluginId]
      ? HttpResponse.json<PluginMeta>(pluginsRegistry[pluginId])
      : HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 })
  );
