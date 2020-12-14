import React, { memo } from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';

export const FieldNameByRegexMatcherViewer = memo<MatcherUIProps<string>>(props => {
  return <span>{props.options}</span>;
});
FieldNameByRegexMatcherViewer.displayName = 'FieldNameByRegexMatcherViewer';

export const fieldNameByRegexReadonlyMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byRegexpReadonly,
  component: FieldNameByRegexMatcherViewer,
  matcher: fieldMatchers.get(FieldMatcherID.byRegexp),
  name: 'Fields with name matching regex',
  description: 'Display properties for fields with names matching a regex',
  optionsToLabel: options => options,
};
