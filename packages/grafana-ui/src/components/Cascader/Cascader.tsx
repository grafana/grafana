import React from 'react';
// import { Input } from '../Forms/Input/Input';
import { Icon } from '../Icon/Icon';
// @ts-ignore
import RCCascader from 'rc-cascader';

import { Select } from '../Forms/Select/Select';
import { FormInputSize } from '../Forms/types';
import { Input } from '../Forms/Input/Input';
import { SelectableValue } from '@grafana/data';

// import { CustomControlProps, SelectBaseProps } from '../Forms/Select/SelectBase';

interface CascaderProps {
  separator?: string;
  options: CascadeOption[];
  onSelect(val: CascadeOption): void;
  size?: FormInputSize;
  defaultValue?: any[];
}

interface CascaderState {
  isSearching: boolean;
  hierachicalOptions: CascadeOption[];
  searchableOptions: Array<SelectableValue<string[]>>;
  focusCascade: boolean;
  //Array for cascade navigation
  rcValue?: SelectableValue<string[]>;
  activeLabel?: string;
}

interface CascadeOption {
  value: any;
  label: string;
  children?: CascadeOption[];
}

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    this.state = {
      isSearching: false,
      focusCascade: false,
      hierachicalOptions: props.options,
      searchableOptions: this.flattenOptions(props.options),
      rcValue: [],
      activeLabel: '',
    };
  }

  flattenOptions = (options: CascadeOption[], optionPath: CascadeOption[] = []) => {
    let selectOptions: Array<SelectableValue<string[]>> = [];
    for (const option of options) {
      const cpy = [...optionPath];
      cpy.push(option);
      if (!option.children) {
        selectOptions.push({
          label: cpy.map(o => o.label).join(this.props.separator || ' / '),
          value: cpy.map(o => o.value),
        });
      } else {
        selectOptions = [...selectOptions, ...this.flattenOptions(option.children, cpy)];
      }
    }
    return selectOptions;
  };

  //For rc-cascader
  onChange = (value: string[], selectedOptions: CascadeOption[]) => {
    this.setState({
      rcValue: value,
      activeLabel: selectedOptions.map(o => o.label).join(this.props.separator || ' / '),
    });

    this.props.onSelect(selectedOptions[selectedOptions.length - 1]);
  };

  onSelect = (obj: SelectableValue<string[]>) => {
    this.setState({
      activeLabel: obj.label,
      rcValue: obj.value,
    });
  };

  onClick = () => {
    this.setState({
      focusCascade: true,
    });
  };

  onBlur = () => {
    this.setState({
      isSearching: false,
    });
  };

  onKeyDown = (e: React.FormEvent<HTMLInputElement>) => {
    console.log('Key down');
    this.setState({
      focusCascade: false,
      isSearching: true,
    });
  };

  render() {
    const { size } = this.props;
    const { focusCascade, isSearching, searchableOptions, rcValue, activeLabel } = this.state;
    return (
      <div>
        {isSearching ? (
          <Select
            // isOpen={isSearching}
            // renderControl={React.forwardRef<any, CustomControlProps<any>>((props, ref) => {
            //   return <Input ref={ref} onClick={this.onClick} onBlur={this.onBlur} onKeyDown={this.onKeyDown} />;
            // })}
            defaultValue={activeLabel}
            autoFocus={!focusCascade}
            onChange={this.onSelect}
            onBlur={this.onBlur}
            options={searchableOptions}
            size={size || 'md'}
            // onKeyDown={this.onKeyDown}
          />
        ) : (
          <RCCascader
            onChange={this.onChange}
            onClick={this.onClick}
            options={this.props.options}
            isFocused={focusCascade}
            value={rcValue}
          >
            <Input
              value={activeLabel}
              onChange={this.onKeyDown}
              size={size || 'md'}
              suffix={<Icon name="caret-down" />}
            />
          </RCCascader>
        )}
      </div>
    );
  }
}
