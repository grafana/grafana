import { type AppPluginConfig, PluginLoadingStrategy, type PluginStarredKind } from '@grafana/data';

import { type MockServedKind } from '../handlers/apis/kindSearch/handlers';

/** The kind the mock app plugin below declares as starrable. */
export const MOCK_STARRED_KIND: PluginStarredKind = {
  group: 'things.ext.grafana.app',
  kind: 'Thing',
  title: 'Thing',
  icon: 'cube',
  path: '/a/test-things-app/things/{name}',
};

/** How the apiserver serves that kind; pair with getKindDiscoveryHandler and getKindSearchHandler. */
export const MOCK_STARRED_KIND_SERVED: MockServedKind = {
  group: MOCK_STARRED_KIND.group,
  version: 'v1alpha1',
  kind: MOCK_STARRED_KIND.kind,
  plural: 'things',
};

/** An installed app plugin that declares MOCK_STARRED_KIND; seed it with setAppPluginMetas from @grafana/runtime/internal. */
export const MOCK_STARRED_KIND_APP: AppPluginConfig = {
  id: 'test-things-app',
  path: 'public/plugins/test-things-app/module.js',
  version: '1.0.0',
  preload: false,
  angular: { detected: false, hideDeprecation: false },
  loadingStrategy: PluginLoadingStrategy.fetch,
  dependencies: { grafanaDependency: '', grafanaVersion: '*', plugins: [], extensions: { exposedComponents: [] } },
  extensions: { addedLinks: [], addedComponents: [], addedFunctions: [], exposedComponents: [], extensionPoints: [] },
  starredKinds: [MOCK_STARRED_KIND],
};
