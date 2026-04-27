import { useMemo } from 'react';

import type { SelectableValue } from '@grafana/data/types';
import { type MatcherScope } from '@grafana/schema';

import { RadioButtonGroup, type RadioButtonGroupProps } from '../Forms/RadioButtonGroup/RadioButtonGroup';

import { getGroupDescriptionForScope, getGroupLabelForScope } from './utils';

export interface MatcherScopeSelectorProps extends Omit<RadioButtonGroupProps<MatcherScope>, 'options'> {
  scopes: Set<MatcherScope>;
  allowedScopes?: MatcherScope[];
}

export function buildScopeOptions(
  providedUniqScopes: Set<MatcherScope>,
  currentScope?: MatcherScope,
  allowedScopes: MatcherScope[] = Array.from(providedUniqScopes)
): Array<SelectableValue<MatcherScope>> {
  const uniqScopes = new Set(providedUniqScopes);

  // we remove series from the list to then add it at the beginning of the returned options.
  if (allowedScopes) {
    uniqScopes.forEach((scope) => {
      if (!allowedScopes.includes(scope)) {
        uniqScopes.delete(scope);
      }
    });
  }
  const scopeNotFound = currentScope && !uniqScopes.has(currentScope);
  if (scopeNotFound) {
    uniqScopes.add(currentScope);
  }

  // always add series at the beginning of the list
  const arr: Array<SelectableValue<MatcherScope>> = [
    {
      label: getGroupLabelForScope('series'),
      description: getGroupDescriptionForScope('series'),
      value: 'series',
    },
  ];

  for (const scope of uniqScopes) {
    if (scope === 'series') {
      continue;
    }
    arr.push({
      label: getGroupLabelForScope(scope),
      description: getGroupDescriptionForScope(scope),
      value: scope,
    });
  }

  return arr;
}

function useMatcherScopesOptions(
  providedUniqScopes: Set<MatcherScope>,
  currentScope?: MatcherScope,
  allowedScopes: MatcherScope[] = Array.from(providedUniqScopes)
): Array<SelectableValue<MatcherScope>> {
  return useMemo(
    () => buildScopeOptions(providedUniqScopes, currentScope, allowedScopes),
    [providedUniqScopes, currentScope, allowedScopes]
  );
}

export function MatcherScopeSelector({ value, scopes, allowedScopes, ...rest }: MatcherScopeSelectorProps) {
  const options = useMatcherScopesOptions(scopes, value, allowedScopes);
  return <RadioButtonGroup {...rest} options={options} value={value ?? options[0]?.value} />;
}

export { getUniqueMatcherScopes } from './utils';
