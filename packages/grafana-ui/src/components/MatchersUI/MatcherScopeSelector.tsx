import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { MatcherScope } from '@grafana/schema';

import { RadioButtonGroup, RadioButtonGroupProps } from '../Forms/RadioButtonGroup/RadioButtonGroup';

import { getGroupDescriptionForScope, getGroupLabelForScope } from './utils';

export interface MatcherScopeSelectorProps extends Omit<RadioButtonGroupProps<MatcherScope>, 'options'> {
  scopes: Set<MatcherScope>;
  allowedScopes?: MatcherScope[];
}

function useScopesOptions(
  providedUniqScopes: Set<MatcherScope>,
  currentScope?: MatcherScope,
  allowedScopes?: MatcherScope[]
): Array<SelectableValue<MatcherScope>> {
  // process the detected scopes and remove disallowed ones
  const uniqScopes = useMemo(() => {
    const result = new Set(providedUniqScopes);
    // Remove the series scope from the set, so we can gaurantee it's the first option, and also
    // because it's the default scope, so if it's the only one detected, we should not show the scope selector.
    result.delete('series');
    if (allowedScopes) {
      result.forEach((scope) => {
        if (!allowedScopes.includes(scope)) {
          result.delete(scope);
        }
      });
    }
    return result;
  }, [providedUniqScopes, allowedScopes]);

  // Check if the current scope is not found in the uniqScopes set
  const scopeNotFound = currentScope && currentScope !== 'series' && !uniqScopes.has(currentScope);

  return useMemo(() => {
    if (uniqScopes.size === 0 && !scopeNotFound) {
      return [];
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

    if (scopeNotFound) {
      arr.push({
        label: getGroupLabelForScope(currentScope),
        description: getGroupDescriptionForScope(currentScope),
        value: currentScope,
      });
    }

    return arr;
  }, [uniqScopes, currentScope, scopeNotFound]);
}

export function MatcherScopeSelector({ value, scopes, allowedScopes, ...rest }: MatcherScopeSelectorProps) {
  const options = useScopesOptions(scopes, value, allowedScopes);
  return <RadioButtonGroup {...rest} options={options} value={value ?? options[0]?.value} />;
}

export { getUniqueMatcherScopes } from './utils';
