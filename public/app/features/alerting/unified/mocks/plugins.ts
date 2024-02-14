import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { PluginMeta } from '@grafana/data';

import { SupportedPlugin } from '../types/pluginBridges';

export function mockPluginSettings(server: SetupServer, plugin: SupportedPlugin, response?: PluginMeta) {
  server.use(
    http.get(`/api/plugins/${plugin}/settings`, () => {
      if (response) {
        return HttpResponse.json(response);
      }
      return HttpResponse.json({}, { status: 404 });
    })
  );
}
