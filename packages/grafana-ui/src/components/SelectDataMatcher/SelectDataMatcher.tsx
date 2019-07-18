import React, { PureComponent } from 'react';

import cloneDeep from 'lodash/cloneDeep';

import { Select } from '../index';

import { DataMatcherConfig, dataMatchers, SelectableValue } from '@grafana/data';

interface Props {
  placeholder?: string;
  onChange: (config: DataMatcherConfig) => void;
  config?: DataMatcherConfig;
  width: number;
}

export class SelectDataMatcher extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  onSelectionChange = (item: SelectableValue<string>) => {
    const { onChange } = this.props;
    const matcher = dataMatchers.getIfExists(item.value);
    if (matcher) {
      const config = { id: matcher.id } as DataMatcherConfig;
      if (matcher.defaultOptions) {
        config.options = cloneDeep(matcher.defaultOptions);
      }
      onChange(config);
    }
  };

  render() {
    const { width, placeholder, config } = this.props;

    const select = dataMatchers.selectOptions(config ? [config.id] : undefined);

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
