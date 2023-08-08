import { rest } from 'msw';
import { SetupServer } from 'msw/lib/node';

import { PluginMeta } from '@grafana/data';

import { SupportedPlugin } from '../types/pluginBridges';

export function mockPluginSettings(server: SetupServer, plugin: SupportedPlugin, response?: PluginMeta) {
  server.use(
    rest.get(`/api/plugins/${plugin}/settings`, (_req, res, ctx) => {
      return response ? res(ctx.status(200), ctx.json(response)) : res(ctx.status(404));
    })
  );
}
