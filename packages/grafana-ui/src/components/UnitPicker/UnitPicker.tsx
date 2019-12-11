import React, { PureComponent } from 'react';

import { Select } from '../Select/Select';

import { getValueFormats, SelectableValue } from '@grafana/data';

interface Props {
  onChange: (item?: string) => void;
  value?: string;
  width?: number;
}

function formatCreateLabel(input: string) {
  return `Custom unit: ${input}`;
}

export class UnitPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  onChange = (value: SelectableValue<string>) => {
    this.props.onChange(value.value);
  };

  render() {
    const { value, width } = this.props;

    const unitGroups = getValueFormats();

    // Need to transform the data structure to work well with Select
    const groupOptions = unitGroups.map(group => {
      const options = group.submenu.map(unit => {
        return {
          label: unit.text,
          value: unit.value,
        };
      });

      return {
        label: group.text,
        options,
      };
    });

    const valueOption = groupOptions.map(group => {
      return group.options.find(option => option.value === value);
    });

    return (
      <Select
        width={width}
        defaultValue={valueOption}
        isSearchable={true}
        allowCustomValue={true}
        formatCreateLabel={formatCreateLabel}
        options={groupOptions}
        placeholder="Choose"
        onChange={this.onChange}
      />
    );
  }
}
