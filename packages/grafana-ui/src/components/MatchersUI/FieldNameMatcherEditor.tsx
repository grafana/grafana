import React from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers } from '@grafana/data';
import Forms from '../Forms';

export class FieldNameMatcherEditor extends React.PureComponent<MatcherUIProps<string>> {
  render() {
    const { data, options, onChange } = this.props;
    const names: Set<string> = new Set();

    for (const frame of data) {
      for (const field of frame.fields) {
        names.add(field.name);
      }
    }
    if (options) {
      names.add(options);
    }
    const selectOptions = Array.from(names).map(n => ({
      value: n,
      label: n,
    }));
    const selectedOption = selectOptions.find(v => v.value === options);

    return (
      <Forms.Select
        allowCustomValue
        value={selectedOption}
        options={selectOptions}
        onChange={o => onChange(o.value!)}
      />
    );
  }
}

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Filter by name',
  description: 'Set properties for fields matching the name',
};
