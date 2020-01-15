import React, { PureComponent } from 'react';

import { getValueFormats } from '@grafana/data';
import { Cascader } from '../Cascader/Cascader';

interface Props {
  onChange: (item?: string) => void;
  value?: string;
  width?: number;
}

export class UnitPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  onChange = (value: string) => {
    this.props.onChange(value);
  };

  render() {
    const { value } = this.props;

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
        value: group.text,
        children: options,
      };
    });

    return <Cascader size="sm" options={groupOptions} initialValue={value} onSelect={this.onChange} />;
  }
}
