import { memo, useMemo, useState } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';
import { MatcherScope } from '@grafana/schema';

import { Combobox } from '../Combobox/Combobox';
import { ComboboxOption } from '../Combobox/types';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { getGroupLabelForScope, getGroupDescriptionForScope } from './utils';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { id, options, onChange } = props;
  const [regexp, setRegexp] = useState(options);
  const [scope, setScope] = useState<MatcherScope>('series');

  const matcherScopeOptions: Array<ComboboxOption<MatcherScope>> = useMemo(() => {
    const arr = [];
    for (const scope of ['series', 'nested', 'annotation'] as const) {
      arr.push({
        label: getGroupLabelForScope(scope),
        description: getGroupDescriptionForScope(scope),
        value: scope,
      });
    }
    return arr;
  }, []);

  return (
    <Stack gap={1} direction="column">
      <Input
        id={id}
        placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
        value={regexp}
        onChange={(e) => setRegexp(e.currentTarget.value)}
        onBlur={() => onChange(regexp, scope)}
      />
      <Combobox<MatcherScope>
        aria-label={t('grafana-ui.field-name-by-regex-matcher.scope-select-aria-label', 'Scope of matched series')}
        options={matcherScopeOptions}
        value={scope}
        onChange={(opt) => {
          setScope(opt.value);
          onChange(regexp, opt.value);
        }}
      />
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
