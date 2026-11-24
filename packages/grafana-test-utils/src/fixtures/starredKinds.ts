import { type MockServedKind } from '../handlers/apis/kindSearch/handlers';

/**
 * An app kind Grafana has a page for, as the apiserver describes it: the Assistant's Page. Pair with
 * getKindDiscoveryHandler and getKindSearchHandler; Grafana shows its stars once discovery serves it.
 */
export const MOCK_STARRED_KIND_SERVED: MockServedKind = {
  group: 'assistant.ext.grafana.app',
  version: 'v0alpha1',
  kind: 'Page',
  plural: 'pages',
};
