import React, { memo } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers, ReadOnlyFieldMatcherOptions } from '@grafana/data';

export const ReadOnlyFieldMatcherEditor = memo<MatcherUIProps<ReadOnlyFieldMatcherOptions>>(({ options }) => {
  return <span>{options.formattedValue}</span>;
});
ReadOnlyFieldMatcherEditor.displayName = 'ReadOnlyFieldMatcherEditor';

export const readOnlyFieldMatcherItem: FieldMatcherUIRegistryItem<ReadOnlyFieldMatcherOptions> = {
  id: FieldMatcherID.readOnly,
  component: ReadOnlyFieldMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.readOnly),
  name: 'Fields matching',
  description: 'Display inner matcher as read only value for the end user.',
  optionsToLabel: options => options.formattedValue,
};
