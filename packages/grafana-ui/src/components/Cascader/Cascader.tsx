import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import RCCascader from 'rc-cascader';
import { PureComponent } from 'react';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';

import { withTheme2 } from '../../themes';
import { Themeable2 } from '../../types';
import { t } from '../../utils/i18n';
import { Icon } from '../Icon/Icon';
import { IconButton } from '../IconButton/IconButton';
import { Input } from '../Input/Input';
import { Stack } from '../Layout/Stack/Stack';
import { Select } from '../Select/Select';

import { onChangeCascader } from './optionMappings';
import { getCascaderStyles } from './styles';

export interface CascaderProps extends Themeable2 {
  /** The separator between levels in the search */
  separator?: string;
  placeholder?: string;
  /** As the onSelect handler reports only the leaf node selected, the leaf nodes should have unique value. */
  options: CascaderOption[];
  /** Changes the value for every selection, including branch nodes. Defaults to true. */
  changeOnSelect?: boolean;
  onSelect(val: string): void;
  /** Sets the width to a multiple of 8px. Should only be used with inline forms. Setting width of the container is preferred in other cases.*/
  width?: number;
  /** Single string that needs to be the same as value of the last item in the selection chain. */
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
  disabled?: boolean;
  /** ID for the underlying Select/Cascader component */
  id?: string;
  /** Whether you can clear the selected value or not */
  isClearable?: boolean;
}

interface CascaderState {
  isSearching: boolean;
  focusCascade: boolean;
  //Array for cascade navigation
  rcValue: SelectableValue<string[]>;
  activeLabel: string;
  inputValue: string;
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

const disableDivFocus = css({
  '&:focus': {
    outline: 'none',
  },
});

const DEFAULT_SEPARATOR = ' / ';

class UnthemedCascader extends PureComponent<CascaderProps, CascaderState> {
  constructor(props: CascaderProps) {
    super(props);
    const searchableOptions = this.getSearchableOptions(props.options);
    const { rcValue, activeLabel } = this.setInitialValue(searchableOptions, props.initialValue);
    this.state = {
      isSearching: false,
      focusCascade: false,
      rcValue,
      activeLabel,
      inputValue: '',
    };
  }

  static defaultProps = { changeOnSelect: true };

  flattenOptions = (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
    let selectOptions: Array<SelectableValue<string[]>> = [];
    for (const option of options) {
      const cpy = [...optionPath];
      cpy.push(option);
      if (!option.items || option.items.length === 0) {
        selectOptions.push({
          singleLabel: cpy[cpy.length - 1].label,
          label: cpy.map((o) => o.label).join(this.props.separator || DEFAULT_SEPARATOR),
          value: cpy.map((o) => o.value),
        });
      } else {
        selectOptions = [...selectOptions, ...this.flattenOptions(option.items, cpy)];
      }
    }
    return selectOptions;
  };

  getSearchableOptions = memoize((options: CascaderOption[]) => this.flattenOptions(options));

  setInitialValue(searchableOptions: Array<SelectableValue<string[]>>, initValue?: string) {
    if (!initValue) {
      return { rcValue: [], activeLabel: '' };
    }
    for (const option of searchableOptions) {
      const optionPath = option.value || [];

      if (optionPath[optionPath.length - 1] === initValue) {
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
    const state: CascaderState = {
      rcValue: { value, label: activeLabel },
      focusCascade: true,
      activeLabel,
      isSearching: false,
      inputValue: activeLabel,
    };
    this.setState(state);
    this.props.onSelect(selectedOptions[selectedOptions.length - 1].value);
  };

  //For select
  onSelect = (obj: SelectableValue<string[]>) => {
    const valueArray = obj.value || [];
    const activeLabel = this.props.displayAllSelectedLevels ? obj.label : obj.singleLabel || '';
    const state: CascaderState = {
      activeLabel: activeLabel,
      inputValue: activeLabel,
      rcValue: { value: valueArray, label: activeLabel },
      isSearching: false,
      focusCascade: false,
    };
    this.setState(state);
    this.props.onSelect(valueArray[valueArray.length - 1]);
  };

  onCreateOption = (value: string) => {
    this.setState({
      activeLabel: value,
      inputValue: value,
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
    if (['ArrowDown', 'ArrowUp', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }
    const { activeLabel } = this.state;
    this.setState({
      focusCascade: false,
      isSearching: true,
      inputValue: activeLabel,
    });
  };

  onSelectInputChange = (value: string) => {
    this.setState({
      inputValue: value,
    });
  };

  render() {
    const {
      allowCustomValue,
      formatCreateLabel,
      placeholder,
      width,
      changeOnSelect,
      options,
      disabled,
      id,
      isClearable,
      theme,
    } = this.props;
    const { focusCascade, isSearching, rcValue, activeLabel, inputValue } = this.state;

    const searchableOptions = this.getSearchableOptions(options);
    const styles = getCascaderStyles(theme);

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
            disabled={disabled}
            inputValue={inputValue}
            inputId={id}
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
            disabled={disabled}
            dropdownClassName={styles.dropdown}
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
                  <Stack gap={0.5}>
                    {isClearable && activeLabel !== '' && (
                      <IconButton
                        name="times"
                        aria-label={t('grafana-ui.cascader.clear-button', 'Clear selection')}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          this.setState({ rcValue: [], activeLabel: '', inputValue: '' });
                          this.props.onSelect('');
                        }}
                      />
                    )}
                    <Icon name={focusCascade ? 'angle-up' : 'angle-down'} />
                  </Stack>
                }
                disabled={disabled}
                id={id}
              />
            </div>
          </RCCascader>
        )}
      </div>
    );
  }
}

export const Cascader = withTheme2(UnthemedCascader);
