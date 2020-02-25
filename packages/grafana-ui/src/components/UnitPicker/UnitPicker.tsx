import React, { PureComponent } from 'react';

import { Select } from '../Select/Select';
import { Cascader, CascaderOption } from '../Cascader/Cascader';
import { getValueFormats, SelectableValue } from '@grafana/data';

interface Props {
  onChange: (item?: string) => void;
  value?: string;
  width?: number;
  /** Temporary flag that uses the new form styles. */
  useNewForms?: boolean;
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
    const { value, width, useNewForms } = this.props;

    // Set the current selection
    let current: SelectableValue<string> | undefined = undefined;

    // All units
    const unitGroups = getValueFormats();

    // Need to transform the data structure to work well with Select
    const groupOptions = unitGroups.map(group => {
      const options = group.submenu.map(unit => {
        const sel = {
          label: unit.text,
          value: unit.value,
        };
        if (unit.value === value) {
          current = sel;
        }
        return sel;
      });
      if (useNewForms) {
        return {
          label: group.text,
          value: group.text,
          items: options,
        };
      }
      return {
        label: group.text,
        options,
      };
    });

    // Show the custom unit
    if (value && !current) {
      current = { value, label: value };
    }

    return useNewForms ? (
      <Cascader
        initialValue={current && current.label}
        allowCustomValue
        formatCreateLabel={formatCreateLabel}
        options={groupOptions as CascaderOption[]}
        placeholder="Choose"
        onSelect={this.props.onChange}
      />
    ) : (
      <Select
        width={width}
        defaultValue={current}
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
