import React, { memo, useCallback } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import { Input } from '../Input/Input';

export const FieldNameByRegexMatcherEditor = memo<MatcherUIProps<string>>(props => {
  const { options } = props;

  const onBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      return props.onChange(e.target.value);
    },
    [props.onChange]
  );

  return <Input placeholder="Enter regular expression" defaultValue={options} onBlur={onBlur} />;
});

export const fieldNameByRegexMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byRegexp,
  component: FieldNameByRegexMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
  name: 'Fields with name matching regex',
  description: 'Set properties for fields with names matching a regex',
  optionsToLabel: options => options,
};
