import React, { PureComponent } from 'react';

import { Select } from '..';

import { getValueFormats } from '../../utils';

interface Props {
  onChange: (item: any) => void;
  defaultValue?: string;
  width?: number;
}

export class UnitPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  render() {
    const { defaultValue, onChange, width } = this.props;

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

    const value = groupOptions.map(group => {
      return group.options.find(option => option.value === defaultValue);
    });

    return (
      <Select
        width={width}
        defaultValue={value}
        isSearchable={true}
        options={groupOptions}
        placeholder="Choose"
        onChange={onChange}
      />
    );
  }
}
