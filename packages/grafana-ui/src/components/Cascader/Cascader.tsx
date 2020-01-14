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

  onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'Enter' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight' &&
      e.key !== 'Enter'
    ) {
      console.log('Key down');
      this.setState({
        focusCascade: false,
        isSearching: true,
      });
    }
  };

  onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      this.setState({
        isSearching: true,
        focusCascade: false,
      });
    }
  };

  onInputChange = (value: string) => {
    this.setState({
      activeLabel: value,
    });
  };

  cascadeToSearch(label?: string) {
    this.setState({
      focusCascade: false,
      isSearching: true,
      activeLabel: label || this.state.activeLabel,
    });
  }

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
            inputValue={activeLabel}
            autoFocus={!focusCascade}
            onChange={this.onSelect}
            onInputChange={this.onInputChange}
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
            onKeyDown={this.onKeyDown}
          >
            <div>
              <Input
                value={activeLabel}
                onKeyDown={this.onInputKeyDown}
                size={size || 'md'}
                suffix={<Icon name="caret-down" />}
              />
            </div>
          </RCCascader>
        )}
      </div>
    );
  }
}
