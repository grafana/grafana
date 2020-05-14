import React from 'react';
import { MatcherUIProps, FieldMatcherUIRegistryItem } from './types';
import { FieldMatcherID, fieldMatchers, getFieldDisplayName } from '@grafana/data';
import { Select } from '../Select/Select';

export class FieldNameMatcherEditor extends React.PureComponent<MatcherUIProps<string>> {
  render() {
    const { data, options, onChange } = this.props;
    const names: Set<string> = new Set();

    for (const frame of data) {
      for (const field of frame.fields) {
        names.add(getFieldDisplayName(field, frame, data));
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
      <Select allowCustomValue value={selectedOption} options={selectOptions} onChange={o => onChange(o.value!)} />
    );
  }
}

export const fieldNameMatcherItem: FieldMatcherUIRegistryItem<string> = {
  id: FieldMatcherID.byName,
  component: FieldNameMatcherEditor,
  matcher: fieldMatchers.get(FieldMatcherID.byName),
  name: 'Filter by field',
  description: 'Set properties for fields matching the name',
};
