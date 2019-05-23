import React, { PureComponent } from 'react';

import isArray from 'lodash/isArray';
import difference from 'lodash/difference';

import { Select } from '../index';

import { getFieldReducers } from '../../utils/fieldReducer';
import { SelectOptionItem } from '../Select/Select';

interface Props {
  placeholder?: string;
  onChange: (stats: string[]) => void;
  value: string[];
  width?: number;
  allowMultiple?: boolean;
  defaultStat?: string;
}

export class StatsPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
    allowMultiple: false,
  };

  componentDidMount() {
    this.checkInput();
  }

  componentDidUpdate(prevProps: Props) {
    this.checkInput();
  }

  checkInput = () => {
    const { value, allowMultiple, defaultStat, onChange } = this.props;

    const current = getFieldReducers(value);
    if (current.length !== value.length) {
      const found = current.map(v => v.id);
      const notFound = difference(value, found);
      console.warn('Unknown stats', notFound, value);
      onChange(current.map(stat => stat.id));
    }

    // Make sure there is only one
    if (!allowMultiple && value.length > 1) {
      console.warn('Removing extra stat', value);
      onChange([value[0]]);
    }

    // Set the reducer from callback
    if (defaultStat && value.length < 1) {
      onChange([defaultStat]);
    }
  };

  onSelectionChange = (item: SelectOptionItem<string>) => {
    const { onChange } = this.props;
    if (isArray(item)) {
      onChange(item.map(v => v.value));
    } else {
      onChange(item.value ? [item.value] : []);
    }
  };

  render() {
    const { width, value, allowMultiple, defaultStat, placeholder } = this.props;
    const options = getFieldReducers().map(s => {
      return {
        value: s.id,
        label: s.name,
        description: s.description,
      };
    });

    const currentValue: Array<SelectOptionItem<string>> = options.filter(option => value.find(stat => option.value === stat));

    return (
      <Select
        width={width}
        value={currentValue}
        isClearable={!defaultStat}
        isMulti={allowMultiple}
        isSearchable={true}
        options={options}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
      />
    );
  }
}
