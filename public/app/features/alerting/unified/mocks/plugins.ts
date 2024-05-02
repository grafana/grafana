import { http, HttpResponse } from 'msw';

import { PluginMeta } from '@grafana/data';
import { plugins } from 'app/features/alerting/unified/testSetup/plugins';

export const pluginsHandler = (pluginsArray: PluginMeta[] = plugins) =>
  http.get<{ pluginId: string }>(`/api/plugins/:pluginId/settings`, ({ params: { pluginId } }) => {
    const matchingPlugin = pluginsArray.find((plugin) => plugin.id === pluginId);
    return matchingPlugin
      ? HttpResponse.json<PluginMeta>(matchingPlugin)
      : HttpResponse.json({ message: 'Plugin not found, no installed plugin with that id' }, { status: 404 });
  });
