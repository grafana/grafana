import React, { PureComponent } from 'react';

import { getValueFormats, SelectableValue } from '@grafana/data';

import { Cascader, CascaderOption } from '../Cascader/Cascader';

export interface UnitPickerProps {
  onChange: (item?: string) => void;
  value?: string;
  width?: number;
}

function formatCreateLabel(input: string) {
  return `Custom unit: ${input}`;
}

export class UnitPicker extends PureComponent<UnitPickerProps> {
  onChange = (value: SelectableValue<string>) => {
    this.props.onChange(value.value);
  };

  render() {
    const { value, width } = this.props;

    // Set the current selection
    let current: SelectableValue<string> | undefined = undefined;

    // All units
    const unitGroups = getValueFormats();

    // Need to transform the data structure to work well with Select
    const groupOptions: CascaderOption[] = unitGroups.map((group) => {
      const options = group.submenu.map((unit) => {
        const sel = {
          label: unit.text,
          value: unit.value,
        };
        if (unit.value === value) {
          current = sel;
        }
        return sel;
      });

      return {
        label: group.text,
        value: group.text,
        items: options,
      };
    });

    // Show the custom unit
    if (value && !current) {
      current = { value, label: value };
    }

    return (
      <Cascader
        width={width}
        initialValue={current && current.label}
        allowCustomValue
        changeOnSelect={false}
        formatCreateLabel={formatCreateLabel}
        options={groupOptions}
        placeholder="Choose"
        onSelect={this.props.onChange}
      />
    );
  }
}
