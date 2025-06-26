import { memo, useCallback } from 'react';
import * as React from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Input } from '../Input/Input';

import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>((props) => {
  const { options, onChange } = props;

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      return onChange(e.target.value);
    },
    [onChange]
  );

  return (
    <Input
      placeholder={t('grafana-ui.field-name-by-regex-matcher.input-placeholder', 'Enter regular expression')}
      defaultValue={options}
      onBlur={onBlur}
    />
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
