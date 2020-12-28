import React, { memo } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers, ReadOnlyFieldMatcherOptions } from '@grafana/data';
import { fieldMatchersUI } from './fieldMatchersUI';

export const ReadOnlyFieldMatcherEditor = memo<MatcherUIProps<ReadOnlyFieldMatcherOptions>>(props => {
  const { options } = props;
  const { matcherOptions } = options;
  const matcherUI = fieldMatchersUI.get(options.matcherId);
  return <matcherUI.component {...props} options={matcherOptions} readOnly={true} prefix={options.prefix} />;
});
ReadOnlyFieldMatcherEditor.displayName = 'ReadOnlyFieldMatcherEditor';

export const readOnlyFieldMatcherItem: FieldMatcherUIRegistryItem<ReadOnlyFieldMatcherOptions> = {
  id: FieldMatcherID.readOnly,
  component: ReadOnlyFieldMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.readOnly),
  name: 'Fields matching',
  description: 'Display inner matcher as read only value for the end user.',
  optionsToLabel: () => '',
  excludeFromPicker: true,
};
