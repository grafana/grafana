import { css } from '@emotion/css';
import RCCascader from 'rc-cascader';
import * as React from 'react';

import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

import { withTheme2 } from '../../themes/ThemeContext';
import { Themeable2 } from '../../types/theme';
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

const UnthemedCascader = ({
  separator,
  placeholder,
  options,
  changeOnSelect = true,
  onSelect,
  width,
  initialValue,
  allowCustomValue,
  formatCreateLabel,
  displayAllSelectedLevels,
  onBlur,
  autoFocus,
  alwaysOpen,
  hideActiveLevelLabel,
  disabled,
  id,
  isClearable,
  theme,
}: CascaderProps) => {
  const flattenOptions = React.useCallback(
    (options: CascaderOption[], optionPath: CascaderOption[] = []) => {
      let selectOptions: Array<SelectableValue<string[]>> = [];
      for (const option of options) {
        const cpy = [...optionPath];
        cpy.push(option);
        if (!option.items || option.items.length === 0) {
          selectOptions.push({
            singleLabel: cpy[cpy.length - 1].label,
            label: cpy.map((o) => o.label).join(separator || DEFAULT_SEPARATOR),
            value: cpy.map((o) => o.value),
          });
        } else {
          selectOptions = [...selectOptions, ...flattenOptions(option.items, cpy)];
        }
      }
      return selectOptions;
    },
    [separator]
  );

  const searchableOptions = React.useMemo(() => flattenOptions(options), [options, flattenOptions]);
  const [cascaderState, setCascaderState] = React.useState<CascaderState>(() => {
    const setInitialValue = (searchableOptions: Array<SelectableValue<string[]>>, initValue?: string) => {
      if (!initValue) {
        return { rcValue: [], activeLabel: '' };
      }
      for (const option of searchableOptions) {
        const optionPath = option.value || [];

        if (optionPath[optionPath.length - 1] === initValue) {
          return {
            rcValue: optionPath,
            activeLabel: displayAllSelectedLevels ? option.label : option.singleLabel || '',
          };
        }
      }
      if (allowCustomValue) {
        return { rcValue: [], activeLabel: initValue };
      }
      return { rcValue: [], activeLabel: '' };
    };
    const { rcValue, activeLabel } = setInitialValue(searchableOptions, initialValue);
    return {
      isSearching: false,
      focusCascade: false,
      rcValue,
      activeLabel,
      inputValue: '',
    };
  });
  const { isSearching, focusCascade, rcValue, activeLabel, inputValue } = cascaderState;

  // For rc-cascader
  const handleChange = React.useCallback(
    (value: string[], selectedOptions: CascaderOption[]) => {
      const activeLabel = hideActiveLevelLabel
        ? ''
        : displayAllSelectedLevels
          ? selectedOptions.map((option) => option.label).join(separator || DEFAULT_SEPARATOR)
          : selectedOptions[selectedOptions.length - 1].label;
      const state: CascaderState = {
        rcValue: { value, label: activeLabel },
        focusCascade: true,
        activeLabel,
        isSearching: false,
        inputValue: activeLabel,
      };
      setCascaderState(state);
      onSelect(selectedOptions[selectedOptions.length - 1].value);
    },
    [displayAllSelectedLevels, hideActiveLevelLabel, onSelect, separator]
  );
  //For select
  const handleSelect = React.useCallback(
    (obj: SelectableValue<string[]>) => {
      const valueArray = obj.value || [];
      const activeLabel = displayAllSelectedLevels ? obj.label : obj.singleLabel || '';
      const state: CascaderState = {
        activeLabel: activeLabel,
        inputValue: activeLabel,
        rcValue: { value: valueArray, label: activeLabel },
        isSearching: false,
        focusCascade: false,
      };
      setCascaderState(state);
      onSelect(valueArray[valueArray.length - 1]);
    },
    [displayAllSelectedLevels, onSelect]
  );

  const handleCreateOption = React.useCallback(
    (value: string) => {
      setCascaderState((prev) => ({
        ...prev,
        activeLabel: value,
        inputValue: value,
        rcValue: [],
        isSearching: false,
      }));
      onSelect(value);
    },
    [onSelect]
  );

  const handleBlur = React.useCallback(() => {
    setCascaderState((prev) => ({
      ...prev,
      isSearching: false,
      focusCascade: false,
      ...(prev.activeLabel === '' && { rcValue: [] }),
    }));
    onBlur?.();
  }, [onBlur]);

  const handleBlurCascade = React.useCallback(() => {
    setCascaderState((prev) => ({
      ...prev,
      focusCascade: false,
    }));

    onBlur?.();
  }, [onBlur]);

  const handleInputKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      return;
    }

    const selectionStart = e.currentTarget.selectionStart;
    const selectionEnd = e.currentTarget.selectionEnd;
    let inputValue = e.currentTarget.value;

    if (selectionStart !== selectionEnd) {
      inputValue = inputValue.substring(0, selectionStart ?? 0) + inputValue.substring(selectionEnd ?? 0);
    }

    setCascaderState((prev) => ({
      ...prev,
      focusCascade: false,
      isSearching: true,
      inputValue: inputValue,
    }));
  }, []);

  const handleSelectInputChange = React.useCallback((value: string) => {
    setCascaderState((prev) => ({
      ...prev,
      inputValue: value,
    }));
  }, []);

  const styles = getCascaderStyles(theme);

  return (
    <div>
      {isSearching ? (
        <Select
          allowCustomValue={allowCustomValue}
          placeholder={placeholder}
          autoFocus={!focusCascade}
          onChange={handleSelect}
          onBlur={handleBlur}
          options={searchableOptions}
          onCreateOption={handleCreateOption}
          formatCreateLabel={formatCreateLabel}
          width={width}
          onInputChange={handleSelectInputChange}
          disabled={disabled}
          inputValue={inputValue}
          inputId={id}
        />
      ) : (
        <RCCascader
          onChange={onChangeCascader(handleChange)}
          options={options}
          changeOnSelect={changeOnSelect}
          value={rcValue.value}
          fieldNames={{ label: 'label', value: 'value', children: 'items' }}
          expandIcon={null}
          open={alwaysOpen}
          disabled={disabled}
          dropdownClassName={styles.dropdown}
        >
          <div className={disableDivFocus}>
            <Input
              autoFocus={autoFocus}
              width={width}
              placeholder={placeholder}
              onBlur={handleBlurCascade}
              value={activeLabel}
              onFocus={(e) => {
                e.currentTarget.select();
              }}
              onKeyDown={handleInputKeyDown}
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
                        setCascaderState((prev) => ({ ...prev, rcValue: [], activeLabel: '', inputValue: '' }));
                        onSelect('');
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
};

/**
 * The cascader component is a Select with a cascading flyout menu. When you have lots of options in your select, they can be hard to navigate from a regular dropdown list. In that case you can use the cascader to organize your options into groups hierarchically. Just like in the Select component, the cascader input doubles as a search field to quickly jump to a selection without navigating the list.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-cascader--docs
 */
export const Cascader = withTheme2(React.memo(UnthemedCascader));
