import React from 'react';
import { Icon } from '../Icon/Icon';
import RCCascader from 'rc-cascader';

import { Select } from '../Select/Select';
import { Input } from '../Input/Input';
import { SelectableValue } from '@grafana/data';
import { css } from '@emotion/css';
import { onChangeCascader } from './optionMappings';
import memoizeOne from 'memoize-one';

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
  displayAllSelectedLevels?: boolean;
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

const DEFAULT_SEPARATOR = '/';

export class Cascader extends React.PureComponent<CascaderProps, CascaderState> {
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
    this.setState({
      rcValue: value,
      focusCascade: true,
      activeLabel: this.props.displayAllSelectedLevels
        ? selectedOptions.map((option) => option.label).join(this.props.separator || DEFAULT_SEPARATOR)
        : selectedOptions[selectedOptions.length - 1].label,
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
    const { allowCustomValue, placeholder, width, changeOnSelect, options } = this.props;
    const { focusCascade, isSearching, rcValue, activeLabel } = this.state;

    const searchableOptions = this.getSearchableOptions(options);

    return (
      <div>
        {isSearching ? (
          <Select
            menuShouldPortal
            allowCustomValue={allowCustomValue}
            placeholder={placeholder}
            autoFocus={!focusCascade}
            onChange={this.onSelect}
            onBlur={this.onBlur}
            options={searchableOptions}
            onCreateOption={this.onCreateOption}
            formatCreateLabel={this.props.formatCreateLabel}
            width={width}
          />
        ) : (
          <RCCascader
            onChange={onChangeCascader(this.onChange)}
            options={this.props.options}
            changeOnSelect={changeOnSelect}
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
