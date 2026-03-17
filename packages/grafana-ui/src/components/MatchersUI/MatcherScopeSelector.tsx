import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { MatcherScope } from '@grafana/schema';

import { RadioButtonGroup, RadioButtonGroupProps } from '../Forms/RadioButtonGroup/RadioButtonGroup';

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
  uniqScopes.delete('series');
  if (allowedScopes) {
    uniqScopes.forEach((scope) => {
      if (!allowedScopes.includes(scope)) {
        uniqScopes.delete(scope);
      }
    });
  }
  const scopeNotFound = currentScope && currentScope !== 'series' && !uniqScopes.has(currentScope);
  if (scopeNotFound) {
    uniqScopes.add(currentScope);
  }

  const arr: Array<SelectableValue<MatcherScope>> = [
    {
      label: getGroupLabelForScope('series'),
      description: getGroupDescriptionForScope('series'),
      value: 'series',
    },
  ];

  for (const scope of uniqScopes) {
    arr.push({
      label: getGroupLabelForScope(scope),
      description: getGroupDescriptionForScope(scope),
      value: scope,
    });
  }

  return arr;
}

function useScopesOptions(
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
  const options = useScopesOptions(scopes, value, allowedScopes);
  return <RadioButtonGroup {...rest} options={options} value={value ?? options[0]?.value} />;
}

export { getUniqueMatcherScopes } from './utils';
