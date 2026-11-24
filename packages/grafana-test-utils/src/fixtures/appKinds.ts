import { type MockAppKind } from '../handlers/apis/kindSearch/handlers';

/**
 * An app kind as the apiserver serves it. Pair with getAPIGroupHandler and getKindSearchHandler: its stars are
 * searched at the version its group prefers.
 */
export const MOCK_APP_KIND: MockAppKind = {
  group: 'things.ext.grafana.app',
  version: 'v1alpha1',
  kind: 'Thing',
  resource: 'things',
};
