import { css } from '@emotion/css';
import memoizeOne from 'memoize-one';
import RCCascader from 'rc-cascader';
import React, { PureComponent } from 'react';

import { SelectableValue } from '@grafana/data';

import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

import { onChangeCascader } from './optionMappings';

export interface CascaderProps {
  /** The separator between levels in the search */
  separator?: string;
  placeholder?: string;
  options: CascaderOption[];
  /** Changes the value for every selection, including branch nodes. Defaults to true. */
  changeOnSelect?: boolean;
  onSelect(val: string): void;
  /** Sets the width to a multiple of 8px. Should only be used with inline forms. Setting width of the container is preferred in other cases.*/
  width?: number;
  initialValue?: string;
  allowCustomValue?: boolean;
  /** A function for formatting the message for custom value creation. Only applies when allowCustomValue is set to true*/
  formatCreateLabel?: (val: string) => string;
  /** If true all levels are shown in the input by simple concatenating the labels */
  displayAllSelectedLevels?: boolean;
  onBlur?: () => void;
  /** When mounted focus automatically on the input */
  autoFocus?: boolean;
  /** Keep the dropdown open all the time, useful in case whole cascader visibility is controlled by the parent */
  alwaysOpen?: boolean;
  /** Don't show what is selected in the cascader input/search. Useful when input is used just as search and the
      cascader is hidden after selection. */
  hideActiveLevelLabel?: boolean;
}

interface CascaderState {
  isSearching: boolean;
  focusCascade: boolean;
  //Array for cascade navigation
  rcValue: SelectableValue<string[]>;
  activeLabel: string;
}

export interface CascaderOption {
  /**
   *  The value used under the hood
   */
  value: string;
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

const DEFAULT_SEPARATOR = '/';

export class Cascader extends PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    const searchableOptions = this.getSearchableOptions(props.options);
    const { rcValue, activeLabel } = this.setInitialValue(searchableOptions, props.initialValue);
    this.state = {
      isSearching: false,
      focusCascade: false,
      rcValue,
      activeLabel,
    };
  }

  static defaultProps = { changeOnSelect: true };

  flattenOptions = (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
    let selectOptions: Array<SelectableValue<string[]>> = [];
    for (const option of options) {
      const cpy = [...optionPath];
      cpy.push(option);
      if (!option.items) {
        selectOptions.push({
          singleLabel: cpy[cpy.length - 1].label,
          label: cpy.map((o) => o.label).join(this.props.separator || ` ${DEFAULT_SEPARATOR} `),
          value: cpy.map((o) => o.value),
        });
      } else {
        selectOptions = [...selectOptions, ...this.flattenOptions(option.items, cpy)];
      }
    }
    return selectOptions;
  };

  getSearchableOptions = memoizeOne((options: CascaderOption[]) => this.flattenOptions(options));

  setInitialValue(searchableOptions: Array<SelectableValue<string[]>>, initValue?: string) {
    if (!initValue) {
      return { rcValue: [], activeLabel: '' };
    }
    for (const option of searchableOptions) {
      const optionPath = option.value || [];

      if (optionPath.indexOf(initValue) === optionPath.length - 1) {
        return {
          rcValue: optionPath,
          activeLabel: this.props.displayAllSelectedLevels ? option.label : option.singleLabel || '',
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
    const activeLabel = this.props.hideActiveLevelLabel
      ? ''
      : this.props.displayAllSelectedLevels
      ? selectedOptions.map((option) => option.label).join(this.props.separator || DEFAULT_SEPARATOR)
      : selectedOptions[selectedOptions.length - 1].label;
    this.setState({
      rcValue: value,
      focusCascade: true,
      activeLabel,
    });

    this.props.onSelect(selectedOptions[selectedOptions.length - 1].value);
  };

  //For select
  onSelect = (obj: SelectableValue<string[]>) => {
    const valueArray = obj.value || [];
    this.setState({
      activeLabel: this.props.displayAllSelectedLevels ? obj.label : obj.singleLabel || '',
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
    this.props.onBlur?.();
  };

  onBlurCascade = () => {
    this.setState({
      focusCascade: false,
    });

    this.props.onBlur?.();
  };

  onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'ArrowLeft', 'ArrowRight', 'Backspace'].includes(e.key)) {
      return;
    }
    this.setState({
      focusCascade: false,
      isSearching: true,
    });
  };

  onSelectInputChange = (value: string) => {
    if (value === '') {
      this.setState({
        isSearching: false,
      });
    }
  };

  render() {
    const { allowCustomValue, formatCreateLabel, placeholder, width, changeOnSelect, options } = this.props;
    const { focusCascade, isSearching, rcValue, activeLabel } = this.state;

    const searchableOptions = this.getSearchableOptions(options);

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
            onCreateOption={this.onCreateOption}
            formatCreateLabel={formatCreateLabel}
            width={width}
            onInputChange={this.onSelectInputChange}
          />
        ) : (
          <RCCascader
            onChange={onChangeCascader(this.onChange)}
            options={options}
            changeOnSelect={changeOnSelect}
            value={rcValue.value}
            fieldNames={{ label: 'label', value: 'value', children: 'items' }}
            expandIcon={null}
            open={this.props.alwaysOpen}
          >
            <div className={disableDivFocus}>
              <Input
                autoFocus={this.props.autoFocus}
                width={width}
                placeholder={placeholder}
                onBlur={this.onBlurCascade}
                value={activeLabel}
                onKeyDown={this.onInputKeyDown}
                onChange={() => {}}
                suffix={
                  focusCascade ? (
                    <Icon name="angle-up" />
                  ) : (
                    <Icon name="angle-down" style={{ marginBottom: 0, marginLeft: '4px' }} />
                  )
                }
              />
            </div>
          </RCCascader>
        )}
      </div>
    );
  }
}
