import React, { PureComponent } from 'react';

import isArray from 'lodash/isArray';
import difference from 'lodash/difference';

import { Select } from '../Select/Select';

import { fieldReducers, SelectableValue } from '@grafana/data';

interface Props {
  placeholder?: string;
  onChange: (stats: string[]) => void;
  stats: string[];
  allowMultiple?: boolean;
  defaultStat?: string;
  className?: string;
  menuPlacement?: 'auto' | 'bottom' | 'top';
}

export class StatsPicker extends PureComponent<Props> {
  static defaultProps: Partial<Props> = {
    allowMultiple: false,
  };

  componentDidMount() {
    this.checkInput();
  }

  componentDidUpdate(prevProps: Props) {
    this.checkInput();
  }

  checkInput = () => {
    const { stats, allowMultiple, defaultStat, onChange } = this.props;

    const current = fieldReducers.list(stats);
    if (current.length !== stats.length) {
      const found = current.map(v => v.id);
      const notFound = difference(stats, found);
      console.warn('Unknown stats', notFound, stats);
      onChange(current.map(stat => stat.id));
    }

    // Make sure there is only one
    if (!allowMultiple && stats.length > 1) {
      console.warn('Removing extra stat', stats);
      onChange([stats[0]]);
    }

    // Set the reducer from callback
    if (defaultStat && stats.length < 1) {
      onChange([defaultStat]);
    }
  };

  onSelectionChange = (item: SelectableValue<string>) => {
    const { onChange } = this.props;
    if (isArray(item)) {
      onChange(item.map(v => v.value));
    } else {
      onChange(item && item.value ? [item.value] : []);
    }
  };

  render() {
    const { stats, allowMultiple, defaultStat, placeholder, className, menuPlacement } = this.props;

    const select = fieldReducers.selectOptions(stats);
    return (
      <Select
        value={select.current}
        className={className}
        isClearable={!defaultStat}
        isMulti={allowMultiple}
        isSearchable={true}
        options={select.options}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
        menuPlacement={menuPlacement}
      />
    );
  }
}
