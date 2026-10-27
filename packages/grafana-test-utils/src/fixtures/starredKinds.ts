import { type StarredKindRegistration } from '@grafana/runtime';

import { type MockServedKind } from '../handlers/apis/kindSearch/handlers';

/** The kind a mock app plugin registers as starrable; pass it to registerStarredKind or getStarsSrv().registerKind. */
export const MOCK_STARRED_KIND: StarredKindRegistration = {
  group: 'things.ext.grafana.app',
  kind: 'Thing',
  title: 'Thing',
  icon: 'cube',
  listUrl: '/a/test-things-app/things',
};

/** How the apiserver serves that kind; pair with getKindDiscoveryHandler and getKindSearchHandler. */
export const MOCK_STARRED_KIND_SERVED: MockServedKind = {
  group: MOCK_STARRED_KIND.group,
  version: 'v1alpha1',
  kind: MOCK_STARRED_KIND.kind,
  plural: 'things',
};
