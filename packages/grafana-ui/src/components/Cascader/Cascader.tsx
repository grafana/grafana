import React from 'react';
import { Icon } from '../Icon/Icon';
import RCCascader from 'rc-cascader';

import { Select } from '../Forms/Select/Select';
import { FormInputSize } from '../Forms/types';
import { Input } from '../Forms/Input/Input';
import { SelectableValue } from '@grafana/data';
import { css } from 'emotion';
import { onChangeCascader } from './optionMappings';

interface CascaderProps {
  /** The seperator between levels in the search */
  separator?: string;
  placeholder?: string;
  options: CascaderOption[];
  onSelect(val: string): void;
  size?: FormInputSize;
  initialValue?: string;
  allowCustomValue?: boolean;
  /** A function for formatting the message for custom value creation. Only applies when allowCustomValue is set to true*/
  formatCreateLabel?: (val: string) => string;
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
  /**
   *  The value used under the hood
   */
  value: any;
  /**
   *  The label to display in the UI
   */
  label: string;
  /** Items will be just flattened into the main list of items recursively. */
  items?: CascaderOption[];
  disabled?: boolean;
  /** Avoid using */
  title?: string;
  /**  Children will be shown in a submenu. Use 'items' instead, as 'children' exist to ensure backwards compatibility.*/
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
          singleLabel: cpy[cpy.length - 1].label,
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
          activeLabel: option.singleLabel || '',
        };
      }
    }
    if (this.props.allowCustomValue) {
      return { rcValue: [], activeLabel: initValue };
    }
    return { rcValue: [], activeLabel: '' };
  }

  //For rc-cascader
  onChange = (value: string[], selectedOptions: CascaderOption[]) => {
    this.setState({
      rcValue: value,
      focusCascade: true,
      activeLabel: selectedOptions[selectedOptions.length - 1].label,
    });

    this.props.onSelect(selectedOptions[selectedOptions.length - 1].value);
  };

  //For select
  onSelect = (obj: SelectableValue<string[]>) => {
    const valueArray = obj.value || [];
    this.setState({
      activeLabel: obj.singleLabel || '',
      rcValue: valueArray,
      isSearching: false,
    });
    this.props.onSelect(valueArray[valueArray.length - 1]);
  };

  onCreateOption = (value: string) => {
    this.setState({
      activeLabel: value,
      rcValue: [],
      isSearching: false,
    });
    this.props.onSelect(value);
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
      e.key === 'ArrowDown' ||
      e.key === 'ArrowUp' ||
      e.key === 'Enter' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowRight'
    ) {
      return;
    }
    this.setState({
      focusCascade: false,
      isSearching: true,
    });
  };

  render() {
    const { size, allowCustomValue, placeholder } = this.props;
    const { focusCascade, isSearching, searchableOptions, rcValue, activeLabel } = this.state;

    return (
      <div>
        {isSearching ? (
          <Select
            allowCustomValue={allowCustomValue}
            placeholder={placeholder}
            autoFocus={!focusCascade}
            onChange={this.onSelect}
            onBlur={this.onBlur}
            options={searchableOptions}
            size={size}
            onCreateOption={this.onCreateOption}
            formatCreateLabel={this.props.formatCreateLabel}
          />
        ) : (
          <RCCascader
            onChange={onChangeCascader(this.onChange)}
            options={this.props.options}
            changeOnSelect
            value={rcValue.value}
            fieldNames={{ label: 'label', value: 'value', children: 'items' }}
            expandIcon={null}
            // Required, otherwise the portal that the popup is shown in will render under other components
            popupClassName={css`
              z-index: 9999;
            `}
          >
            <div className={disableDivFocus}>
              <Input
                size={size}
                placeholder={placeholder}
                onBlur={this.onBlurCascade}
                value={activeLabel}
                onKeyDown={this.onInputKeyDown}
                onChange={() => {}}
                suffix={focusCascade ? <Icon name="caret-up" /> : <Icon name="caret-down" />}
              />
            </div>
          </RCCascader>
        )}
      </div>
    );
  }
}
