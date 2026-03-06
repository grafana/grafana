import { useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { MatcherScope } from '@grafana/schema';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';
import { Field } from '../Forms/Field';

import { getGroupDescriptionForScope, getGroupLabelForScope } from './utils';

export interface MatcherScopeSelectorProps {
  scope?: MatcherScope;
  scopes: Set<MatcherScope>;
  onChange: (newScope: MatcherScope) => void;
}

function useScopesOptions(
  uniqScopes: Set<MatcherScope>,
  currentScope?: MatcherScope
): Array<ComboboxOption<MatcherScope>> {
  return useMemo(() => {
    // Remove the series scope from the set, so we can gaurantee it's the first option, and also
    // because it's the default scope, so if it's the only one detected, we should not show the scope selector.
    uniqScopes.delete('series');

    const scopeNotFound = currentScope && currentScope !== 'series' && !uniqScopes.has(currentScope);

    if (uniqScopes.size === 0 && !scopeNotFound) {
      return [];
    }

    const arr: Array<ComboboxOption<MatcherScope>> = [
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
      const innerLabel = getGroupLabelForScope(currentScope);

      arr.push({
        label: t('grafana-ui.matchers.labels.not-found', '{{name}} (not found)', { name: innerLabel }),
        description: getGroupDescriptionForScope(currentScope),
        value: currentScope,
      });
    }

    return arr;
  }, [uniqScopes, currentScope]);
}

export function MatcherScopeSelector({ scope, scopes, onChange }: MatcherScopeSelectorProps) {
  const id = useId();
  const matcherScopeOptions = useScopesOptions(scopes, scope);

  if (matcherScopeOptions.length === 0) {
    return null;
  }

  return (
    <Field noMargin label={t('grafana-ui.field-name-by-regex-matcher.scope', 'Override scope')}>
      <Combobox
        id={id}
        options={matcherScopeOptions}
        value={scope ?? 'series'}
        onChange={(opt) => onChange(opt.value!)}
      />
    </Field>
  );
}
