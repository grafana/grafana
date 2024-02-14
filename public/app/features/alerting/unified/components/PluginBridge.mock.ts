// bit of setup to mock HTTP request responses
import 'whatwg-fetch';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import { SupportedPlugin } from '../types/pluginBridges';

export const NON_EXISTING_PLUGIN = '__does_not_exist__';

const server = setupServer(
  http.get(`/api/plugins/${NON_EXISTING_PLUGIN}/settings`, async () =>
    HttpResponse.json(
      {},
      {
        status: 404,
      }
    )
  ),
  http.get(`/api/plugins/${SupportedPlugin.Incident}/settings`, async () => {
    return HttpResponse.json({
      enabled: true,
    });
  })
);

export { server };
