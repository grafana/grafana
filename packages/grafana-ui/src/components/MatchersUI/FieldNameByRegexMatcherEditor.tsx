import { memo, useMemo, useState } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MatcherScope } from '@grafana/schema';

import { Combobox } from '../Combobox/Combobox';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { useFieldDisplayNames, useScopesOptions } from './utils';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { id, options, onChange, data, scope = 'series' } = props;
  const [regexp, setRegexp] = useState(options);
  const names = useFieldDisplayNames(data);
  const uniqScopes = useMemo(() => new Set([...names.scopes.values()]), [names]);
  const matcherScopeOptions = useScopesOptions(uniqScopes, scope);

  return (
    <Stack gap={1} direction="column">
      <Input
        id={id}
        placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
        value={regexp}
        onChange={(e) => setRegexp(e.currentTarget.value)}
        onBlur={() => onChange(regexp, scope)}
      />
      {matcherScopeOptions.length > 0 ? (
        <Combobox<MatcherScope>
          aria-label={t('grafana-ui.field-name-by-regex-matcher.scope-select-aria-label', 'Scope of matched series')}
          options={matcherScopeOptions}
          value={scope}
          onChange={(opt) => onChange(regexp, opt.value)}
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
