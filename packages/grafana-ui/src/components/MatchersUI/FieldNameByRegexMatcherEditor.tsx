import React, { memo, useCallback } from 'react';

import { FieldMatcherID, fieldMatchers } from '@grafana/data';

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

  return <Input placeholder="Enter regular expression" defaultValue={options} onBlur={onBlur} />;
});
FieldNameByRegexMatcherEditor.displayName = 'FieldNameByRegexMatcherEditor';

export const fieldNameByRegexMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byRegexp,
  component: FieldNameByRegexMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
  name: 'Fields with name matching regex',
  description: 'Set properties for fields with names matching a regex',
  optionsToLabel: (options) => options,
};
