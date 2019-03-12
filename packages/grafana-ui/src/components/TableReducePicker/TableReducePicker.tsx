import React, { PureComponent } from 'react';

import isArray from 'lodash/isArray';

import { Select } from '../index';

import { getTableReducers } from '../../utils/tableReducer';
import { SelectOptionItem } from '../Select/Select';

interface Props {
  onChange: (reducers: string[]) => void;
  reducers: string[];
  width?: number;
}

export class TableReducePicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  onSelectionChange = (item: SelectOptionItem) => {
    const { onChange } = this.props;
    if (isArray(item)) {
      onChange(item.map(v => v.value));
    } else {
      onChange([item.value]);
    }
  };

  render() {
    const { width, reducers } = this.props;

    const allReducers = getTableReducers();

    // Need to transform the data structure to work well with Select
    const reducerOptions = allReducers.map(info => {
      return {
        label: info.name,
        value: info.key,
        description: info.description,
      };
    });

    const current = reducerOptions.filter(options => reducers.includes(options.value));
    return (
      <Select
        width={width}
        value={current}
        isMulti={true}
        isSearchable={true}
        options={reducerOptions}
        placeholder="Choose"
        onChange={this.onSelectionChange}
      />
    );
  }
}
