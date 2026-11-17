import { type UrlQueryMap } from '@grafana/data';

import { type Hint, type Scope, type ScopeType } from './liveScenario';

// The scope on show, and the hint that led to it, live in the URL. Browser Back and Forward then move between the
// overview and a scope, and a copied link or a reload opens the same scope.
const SCOPE_TYPE_PARAM = 'scope-type';
const SCOPE_VALUE_PARAM = 'scope-value';
const HINT_PARAM = 'hint';

const SCOPE_TYPES: ScopeType[] = ['service', 'environment', 'namespace'];

// A scope in the URL can be typed by hand, so a type this page does not know or an empty value counts as no scope.
export function scopeFromQuery(query: UrlQueryMap): Scope | undefined {
  const type = SCOPE_TYPES.find((known) => known === query[SCOPE_TYPE_PARAM]);
  const value = query[SCOPE_VALUE_PARAM];
  return type && typeof value === 'string' && value !== '' ? { type, value } : undefined;
}

export function hintIdFromQuery(query: UrlQueryMap): string | undefined {
  const id = query[HINT_PARAM];
  return typeof id === 'string' && id !== '' ? id : undefined;
}

// A null value removes its parameter, so opening a scope without a hint drops the hint of the scope before it.
export function scopeQuery(scope: Scope, hint?: Hint): UrlQueryMap {
  return { [SCOPE_TYPE_PARAM]: scope.type, [SCOPE_VALUE_PARAM]: scope.value, [HINT_PARAM]: hint?.id ?? null };
}

export const NO_SCOPE_QUERY: UrlQueryMap = { [SCOPE_TYPE_PARAM]: null, [SCOPE_VALUE_PARAM]: null, [HINT_PARAM]: null };
