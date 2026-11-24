import { type MockServedKind } from '../handlers/apis/kindSearch/handlers';

/**
 * An app kind Grafana has a page for, as the apiserver serves it: the Assistant's Page. Pair with
 * getAPIGroupHandler and getKindSearchHandler; Grafana shows its stars once the instance serves its group.
 */
export const MOCK_STARRED_KIND_SERVED: MockServedKind = {
  group: 'assistant.ext.grafana.app',
  version: 'v0alpha1',
  kind: 'Page',
  plural: 'pages',
};
