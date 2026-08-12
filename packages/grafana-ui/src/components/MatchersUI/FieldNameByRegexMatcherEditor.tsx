import { memo, useState } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';

import { type MatcherUIProps, type FieldMatcherUIRegistryItem } from './types';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { id, options, onChange, scope = 'series' } = props;
  const [regexp, setRegexp] = useState(options);

  return (
    <Stack gap={1} direction="column">
      <Input
        id={id}
        placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
        value={regexp}
        onChange={(e) => setRegexp(e.currentTarget.value)}
        onBlur={() => onChange(regexp, scope)}
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
