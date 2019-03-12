import React, { PureComponent } from 'react';

import isArray from 'lodash/isArray';

import { Select } from '../index';

import { getTableReducers } from '../../utils/tableReducer';
import { SelectOptionItem } from '../Select/Select';

interface Props {
  placeholder?: string;
  onChange: (reducers: string[]) => void;
  reducers: string[];
  width?: number;
  allowMultiple?: boolean;
  defaultReducer?: string;
}

export class TableReducePicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
    allowMultiple: false,
  };

  componentDidMount() {
    console.log('MOUNT!', this);
    this.checkInput();
  }

  componentDidUpdate(prevProps: Props) {
    console.log('UPDATE', this);
    this.checkInput();
  }

  checkInput = () => {
    const { reducers, allowMultiple, defaultReducer, onChange } = this.props;
    if (!allowMultiple && reducers.length > 1) {
      onChange(reducers.slice(0, 1));
    }
    if (defaultReducer && reducers.length < 1) {
      onChange([defaultReducer]);
    }
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
    const { width, reducers, allowMultiple, defaultReducer, placeholder } = this.props;
    const current = getTableReducers(reducers);

    return (
      <Select
        width={width}
        value={current}
        isClearable={!defaultReducer}
        isMulti={allowMultiple}
        isSearchable={true}
        options={getTableReducers()}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
      />
    );
  }
}
