import React from 'react';
import { Icon } from '../Icon/Icon';
// @ts-ignore
import RCCascader from 'rc-cascader';

import { Select } from '../Forms/Select/Select';
import { FormInputSize } from '../Forms/types';
import { Input } from '../Forms/Input/Input';
import { SelectableValue } from '@grafana/data';
import { css } from 'emotion';

interface CascaderProps {
  separator?: string;
  options: CascaderOption[];
  onSelect(val: string): void;
  size?: FormInputSize;
  initialValue?: string;
}

interface CascaderState {
  isSearching: boolean;
  searchableOptions: Array<SelectableValue<string[]>>;
  focusCascade: boolean;
  //Array for cascade navigation
  rcValue: SelectableValue<string[]>;
  activeLabel: string;
}

export interface CascaderOption {
  value: any;
  label: string;
  // Items will be just flattened into the main list of items recursively.
  items?: CascaderOption[];
  disabled?: boolean;
  title?: string;
  // Children will be shown in a submenu.
  children?: CascaderOption[];
}

const disableDivFocus = css(`
&:focus{
  outline: none;
}
`);

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    const searchableOptions = this.flattenOptions(props.options);
    const { rcValue, activeLabel } = this.setInitialValue(searchableOptions, props.initialValue);
    this.state = {
      isSearching: false,
      focusCascade: false,
      searchableOptions,
      rcValue,
      activeLabel,
    };
  }

  flattenOptions = (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
    let selectOptions: Array<SelectableValue<string[]>> = [];
    for (const option of options) {
      const cpy = [...optionPath];
      cpy.push(option);
      if (!option.items) {
        selectOptions.push({
          label: cpy.map(o => o.label).join(this.props.separator || ' / '),
          value: cpy.map(o => o.value),
        });
      } else {
        selectOptions = [...selectOptions, ...this.flattenOptions(option.items, cpy)];
      }
    }
    return selectOptions;
  };

  setInitialValue(searchableOptions: Array<SelectableValue<string[]>>, initValue?: string) {
    if (!initValue) {
      return { rcValue: [], activeLabel: '' };
    }
    for (const option of searchableOptions) {
      const optionPath = option.value || [];

      if (optionPath.indexOf(initValue) === optionPath.length - 1) {
        return {
          rcValue: optionPath,
          activeLabel: option.label || '',
        };
      }
    }
    return { rcValue: [], activeLabel: '' };
  }

  //For rc-cascader
  onChange = (value: string[], selectedOptions: CascaderOption[]) => {
    this.setState({
      rcValue: value,
      activeLabel: selectedOptions.map(o => o.label).join(this.props.separator || ' / '),
    });

    this.props.onSelect(selectedOptions[selectedOptions.length - 1].value);
  };

  //For select
  onSelect = (obj: SelectableValue<string[]>) => {
    this.setState({
      activeLabel: obj.label || '',
      rcValue: obj.value || [],
      isSearching: false,
    });
    this.props.onSelect(this.state.rcValue[this.state.rcValue.length - 1]);
  };

  onClick = () => {
    this.setState({
      focusCascade: true,
    });
  };

  onBlur = () => {
    this.setState({
      isSearching: false,
      focusCascade: false,
    });

    if (this.state.activeLabel === '') {
      this.setState({
        rcValue: [],
      });
    }
  };

  onBlurCascade = () => {
    this.setState({
      focusCascade: false,
    });
  };

  onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      e.key !== 'ArrowDown' &&
      e.key !== 'ArrowUp' &&
      e.key !== 'Enter' &&
      e.key !== 'ArrowLeft' &&
      e.key !== 'ArrowRight'
    ) {
      this.setState({
        focusCascade: false,
        isSearching: true,
      });
      if (e.key === 'Backspace') {
        const label = this.state.activeLabel || '';
        this.setState({
          activeLabel: label.slice(0, -1),
        });
      }
    }
  };

  onInputChange = (value: string) => {
    this.setState({
      activeLabel: value,
    });
  };

  render() {
    const { size } = this.props;
    const { focusCascade, isSearching, searchableOptions, rcValue, activeLabel } = this.state;

    return (
      <div>
        {isSearching ? (
          <Select
            inputValue={activeLabel}
            placeholder="Search"
            autoFocus={!focusCascade}
            onChange={this.onSelect}
            onInputChange={this.onInputChange}
            onBlur={this.onBlur}
            options={searchableOptions}
            size={size || 'md'}
          />
        ) : (
          <RCCascader
            onChange={this.onChange}
            onClick={this.onClick}
            options={this.props.options}
            isFocused={focusCascade}
            onBlur={this.onBlurCascade}
            value={rcValue}
            fieldNames={{ label: 'label', value: 'value', children: 'items' }}
            expandIcon={null}
          >
            <div className={disableDivFocus}>
              <Input
                value={activeLabel}
                onKeyDown={this.onInputKeyDown}
                onChange={() => {}}
                size={size || 'md'}
                suffix={focusCascade ? <Icon name="caret-up" /> : <Icon name="caret-down" />}
              />
            </div>
          </RCCascader>
        )}
      </div>
    );
  }
}
