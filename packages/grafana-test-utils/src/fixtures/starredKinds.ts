import { type NavModelItem } from '@grafana/data';

import { type MockServedKind } from '../handlers/apis/kindSearch/handlers';

/**
 * A kind a mock app plugin serves, as the apiserver describes it; pair with getKindDiscoveryHandler
 * and getKindSearchHandler. Grafana shows its stars once the plugin page below is in the nav tree.
 */
export const MOCK_STARRED_KIND_SERVED: MockServedKind = {
  group: 'things.ext.grafana.app',
  version: 'v1alpha1',
  kind: 'Thing',
  plural: 'things',
};

/** The plugin page that lists the kind; add it to `config.bootData.navTree` before the store is built. */
export const MOCK_STARRED_KIND_PAGE: NavModelItem = {
  id: 'plugin-page-test-things-app',
  text: 'Things',
  url: '/a/test-things-app/things',
  pluginId: 'test-things-app',
};
