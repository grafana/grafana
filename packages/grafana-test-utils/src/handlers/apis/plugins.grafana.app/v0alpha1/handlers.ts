import { HttpResponse, type HttpResponseResolver, http } from 'msw';

import { mockPluginMetasStore } from '../../../../fixtures/pluginMetas';

export const GET_PLUGIN_METAS_URL = '/apis/plugins.grafana.app/v0alpha1/namespaces/:namespace/metas';

/** Override the metas endpoint for a test, e.g. `server.use(customGetPluginMetasHandler(() => HttpResponse.json(null, { status: 500 })))` */
export const customGetPluginMetasHandler = (resolver: HttpResponseResolver) => http.get(GET_PLUGIN_METAS_URL, resolver);

const getMetasHandler = () =>
  customGetPluginMetasHandler(() =>
    HttpResponse.json({
      kind: 'MetaList',
      apiVersion: 'plugins.grafana.app/v0alpha1',
      metadata: {},
      items: mockPluginMetasStore,
    })
  );

const handlers = [getMetasHandler()];

export default handlers;
