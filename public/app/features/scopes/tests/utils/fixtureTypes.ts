import {
  MOCK_DEFAULT_SCOPE,
  MOCK_NODES,
  MOCK_SCOPE_NAVIGATIONS,
  MOCK_SCOPES,
  MOCK_SUB_SCOPE_LOKI_ITEMS,
  MOCK_SUB_SCOPE_MIMIR_ITEMS,
} from '@grafana/test-utils/unstable';
import { type Scope, type ScopeNavigation, type ScopeNode } from 'app/api/clients/scope/v0alpha1/endpoints.gen';

// @grafana/test-utils cannot import the generated scope API client, so the scope fixtures are checked against
// it here, where typecheck covers them. A failure means the fixtures no longer match the API.
export const scopeFixtures = {
  scopes: [...MOCK_SCOPES, MOCK_DEFAULT_SCOPE] satisfies Scope[],
  nodes: MOCK_NODES satisfies ScopeNode[],
  navigations: [
    ...MOCK_SCOPE_NAVIGATIONS,
    ...MOCK_SUB_SCOPE_MIMIR_ITEMS,
    ...MOCK_SUB_SCOPE_LOKI_ITEMS,
  ] satisfies ScopeNavigation[],
};

// Assignability does not reject extra fields, so also fail when a fixture type keeps a field the API no longer has.
type OnlyApiKeys<Fixture, Api> = [Exclude<keyof Fixture, keyof Api>] extends [never] ? true : never;

export const scopeFixtureKeys: Array<true> = [
  true satisfies OnlyApiKeys<(typeof MOCK_SCOPES)[number]['spec'], NonNullable<Scope['spec']>>,
  true satisfies OnlyApiKeys<(typeof MOCK_NODES)[number]['spec'], NonNullable<ScopeNode['spec']>>,
  true satisfies OnlyApiKeys<(typeof MOCK_SCOPE_NAVIGATIONS)[number]['spec'], NonNullable<ScopeNavigation['spec']>>,
  true satisfies OnlyApiKeys<(typeof MOCK_SCOPE_NAVIGATIONS)[number]['status'], NonNullable<ScopeNavigation['status']>>,
];
