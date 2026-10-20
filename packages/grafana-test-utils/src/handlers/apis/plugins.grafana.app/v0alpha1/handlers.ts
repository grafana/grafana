import { HttpResponse, type HttpResponseResolver, http } from 'msw';

import { mockPluginMetasStore } from '../../../../fixtures/pluginMetas';

const GET_PLUGIN_METAS_URL = '/apis/plugins.grafana.app/v0alpha1/namespaces/:namespace/metas';

/** Overrides the metas endpoint, e.g. to answer with an error status */
const customGetPluginMetasHandler = (resolver: HttpResponseResolver) => http.get(GET_PLUGIN_METAS_URL, resolver);

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
