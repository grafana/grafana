import React from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';

export class FieldNameMatcherEditor extends React.PureComponent<MatcherUIProps<string>> {
  render() {
    const { matcher } = this.props;

    return <div>TODO: MATCH STRING for: {matcher.id}</div>;
  }
}

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Filter by name',
  description: 'Set properties for fields matching the name',
};
