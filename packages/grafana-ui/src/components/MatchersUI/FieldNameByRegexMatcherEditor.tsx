import { memo, useMemo, useState } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MatcherScope } from '@grafana/schema';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { getGroupLabelForScope, getGroupDescriptionForScope, useFieldDisplayNames } from './utils';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { id, options, onChange, data, scope: scopeFromProps } = props;
  const [regexp, setRegexp] = useState(options);
  const [scope, setScope] = useState<MatcherScope>(scopeFromProps ?? 'series');
  const names = useFieldDisplayNames(data);

  const matcherScopeOptions: Array<ComboboxOption<MatcherScope>> = useMemo(() => {
    const uniqScopes = new Set<MatcherScope>(names.scopes.values());
    // Remove the series scope from the set, so we can gaurantee it's the first option, and also
    // because it's the default scope, so if it's the only one detected, we should not show the scope selector.
    uniqScopes.delete('series');
    if (uniqScopes.size === 0) {
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

    return arr;
  }, [names.scopes]);

  return (
    <Stack gap={1} direction="column">
      <Input
        id={id}
        placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
        value={regexp}
        onChange={(e) => setRegexp(e.currentTarget.value)}
        onBlur={() => onChange(regexp, scope)}
      />
      {scopeFromProps || matcherScopeOptions.length > 0 ? (
        <Combobox<MatcherScope>
          aria-label={t('grafana-ui.field-name-by-regex-matcher.scope-select-aria-label', 'Scope of matched series')}
          options={matcherScopeOptions}
          value={scope}
          onChange={(opt) => {
            setScope(opt.value);
            onChange(regexp, opt.value);
          }}
        />
      ) : null}
    </Stack>
  );
});

FieldNameByRegexMatcherEditor.displayName = 'FieldNameByRegexMatcherEditor';

export const getFieldNameByRegexMatcherItem: () => FieldMatcherUIRegistryItem<string> = () => ({
  id: FieldMatcherID.byRegexp,
  component: FieldNameByRegexMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
  name: t('grafana-ui.matchers-ui.name-field-name-by-regex-matcher', 'Fields with name matching regex'),
  description: t(
    'grafana-ui.matchers-ui.description-field-name-by-regex-matcher',
    'Set properties for fields with names matching a regex'
  ),
  optionsToLabel: (options) => options,
});
