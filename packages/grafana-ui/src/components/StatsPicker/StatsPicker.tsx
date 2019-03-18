import React, { PureComponent } from 'react';

import isArray from 'lodash/isArray';

import { Select } from '../index';

import { getStatsCalculators } from '../../utils/statsCalculator';
import { SelectOptionItem } from '../Select/Select';

interface Props {
  placeholder?: string;
  onChange: (stats: string[]) => void;
  stats: string[];
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
    const { stats, allowMultiple, defaultStat, onChange } = this.props;

    // Check that the selected reducers are all real
    const notFound: string[] = [];
    const current = getStatsCalculators(stats, notFound);
    if (notFound.length > 0) {
      console.warn('Unknown reducers', notFound, stats);
      onChange(current.map(reducer => reducer.value));
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

  onSelectionChange = (item: SelectOptionItem) => {
    const { onChange } = this.props;
    if (isArray(item)) {
      onChange(item.map(v => v.value));
    } else {
      onChange([item.value]);
    }
  };

  render() {
    const { width, stats, allowMultiple, defaultStat, placeholder } = this.props;
    const current = getStatsCalculators(stats);

    return (
      <Select
        width={width}
        value={current}
        isClearable={!defaultStat}
        isMulti={allowMultiple}
        isSearchable={true}
        options={getStatsCalculators()}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
      />
    );
  }
}
