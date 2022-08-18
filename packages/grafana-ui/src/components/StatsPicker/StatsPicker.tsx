import { difference } from 'lodash';
import React, { PureComponent } from 'react';

import { fieldReducers, SelectableValue } from '@grafana/data';

import { Select } from '../Select/Select';

export interface Props {
  placeholder?: string;
  onChange: (stats: string[]) => void;
  stats: string[];
  allowMultiple?: boolean;
  defaultStat?: string;
  className?: string;
  width?: number;
  menuPlacement?: 'auto' | 'bottom' | 'top';
  inputId?: string;
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
      const found = current.map((v) => v.id);
      const notFound = difference(stats, found);
      console.warn('Unknown stats', notFound, stats);
      onChange(current.map((stat) => stat.id));
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
    if (Array.isArray(item)) {
      onChange(item.map((v) => v.value));
    } else {
      onChange(item && item.value ? [item.value] : []);
    }
  };

  render() {
    const { stats, allowMultiple, defaultStat, placeholder, className, menuPlacement, width, inputId } = this.props;

    const select = fieldReducers.selectOptions(stats);
    return (
      <Select
        value={select.current}
        className={className}
        isClearable={!defaultStat}
        isMulti={allowMultiple}
        width={width}
        isSearchable={true}
        options={select.options}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
        menuPlacement={menuPlacement}
        inputId={inputId}
      />
    );
  }
}
