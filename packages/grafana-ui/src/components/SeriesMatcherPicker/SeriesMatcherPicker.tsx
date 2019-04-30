import React, { PureComponent } from 'react';

import cloneDeep from 'lodash/cloneDeep';

import { Select } from '../index';

import { SelectOptionItem } from '../Select/Select';
import { SeriesMatcherConfig, seriesMatchers } from '../../utils/index';

interface Props {
  placeholder?: string;
  onChange: (config: SeriesMatcherConfig) => void;
  config?: SeriesMatcherConfig;
  width: number;
}

export class SeriesMatcherPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  onSelectionChange = (item: SelectOptionItem<string>) => {
    const { onChange } = this.props;
    const matcher = seriesMatchers.getIfExists(item.value);
    if (matcher) {
      const config = { id: matcher.id } as SeriesMatcherConfig;
      if (matcher.defaultOptions) {
        config.options = cloneDeep(matcher.defaultOptions);
      }
      onChange(config);
    }
  };

  render() {
    const { width, placeholder, config } = this.props;

    const select = seriesMatchers.selectOptions(config ? [config.id] : undefined);

    return (
      <Select
        width={width}
        isMulti={false}
        isSearchable={true}
        value={select.current[0]}
        options={select.options}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
      />
    );
  }
}
