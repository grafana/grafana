import React, { PureComponent } from 'react';

import { Select } from '../index';

import { SelectOptionItem } from '../Select/Select';
import { SeriesDataMatcherConfig, seriesDataMatchers } from '../../utils/index';

interface Props {
  placeholder?: string;
  onChange: (config: SeriesDataMatcherConfig) => void;
  config?: SeriesDataMatcherConfig;
  width: number;
}

export class SeriesMatcherPicker extends PureComponent<Props> {
  static defaultProps = {
    width: 12,
  };

  componentDidMount() {
    this.checkInput();
  }

  componentDidUpdate(prevProps: Props) {
    this.checkInput();
  }

  checkInput = () => {
    console.log('CHECK?');
  };

  onSelectionChange = (item: SelectOptionItem<string>) => {
    // const { onChange } = this.props;
    console.log('change', item);
  };

  render() {
    const { width, placeholder } = this.props;

    const options = seriesDataMatchers.list().map(s => {
      return {
        value: s.id,
        label: s.name,
        description: s.description,
      };
    });

    return (
      <Select
        width={width}
        isMulti={false}
        isSearchable={true}
        options={options}
        placeholder={placeholder}
        onChange={this.onSelectionChange}
      />
    );
  }
}
