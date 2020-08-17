import React, { FC, useState, useCallback, useRef } from 'react';
import { cx } from 'emotion';
import { CustomScrollbar, Icon, IconButton, Input } from '..';
import Downshift, { GetItemPropsOptions } from 'downshift';
import { SelectableValue } from '@grafana/data';
import { useTheme } from '../../themes';
import { getSelectStyles } from '../Select/getSelectStyles';
import { Fetch } from '../Select/Fetch';
import debounce from 'debounce-promise';
import { usePopper } from 'react-popper';

interface SelectNGProps {
  options: Array<SelectableValue<any>>;
  placeholder?: string;
  noOptionsMessage?: string;
}

interface AsyncSelectNGProps extends Omit<SelectNGProps, 'options'> {
  loadOptions: (query: string | null) => Promise<Array<SelectableValue<any>>>;
}
const sameWidth = {
  name: 'sameWidth',
  enabled: true,
  phase: 'beforeWrite',
  requires: ['computeStyles'],
  fn: ({ state }: any) => {
    state.styles.popper.width = `${state.rects.reference.width}px`;
  },
  effect: ({ state }: any) => {
    state.elements.popper.style.width = `${state.elements.reference.offsetWidth}px`;
  },
};

export const SelectNG: FC<SelectNGProps> = ({ options }) => {
  const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const popper = usePopper(referenceElement, popperElement, {
    modifiers: [
      sameWidth as any,
      // {
      //   name: 'arrow',
      //   enabled: false,
      // },
    ],
    placement: 'auto',
  });

  const filterOptions = useCallback(
    (inputValue: string | null) => {
      if (!inputValue) {
        return options;
      }
      return options.filter(o => o.label!.includes(inputValue));
    },
    [options]
  );
  return (
    <>
      <Downshift
        itemToString={(value: SelectableValue<any> | null) => value?.label || ''}
        onChange={(item: SelectableValue<any> | null) => {
          console.log(item);
        }}
      >
        {({
          getInputProps,
          getToggleButtonProps,
          getMenuProps,
          getItemProps,
          isOpen,
          highlightedIndex,
          selectedItem,
          inputValue,
        }) => {
          const dropdownButton = (
            <IconButton name="arrow-down" {...getToggleButtonProps()} aria-label={'toggle menu'} />
          );

          return (
            <div>
              <div
                ref={el => {
                  setReferenceElement(el);
                }}
              >
                <Input
                  {...getInputProps()}
                  type="text"
                  placeholder="Select value..."
                  value={selectedItem ? selectedItem.label : undefined}
                  suffix={dropdownButton}
                />
              </div>
              {isOpen ? (
                <div
                  ref={el => {
                    setPopperElement(el);
                  }}
                  style={popper.styles.popper}
                  {...popper.attributes.popper}
                >
                  <SelectMenu
                    {...getMenuProps()}
                    options={filterOptions(inputValue)}
                    highlightedIndex={highlightedIndex}
                    selectedItem={selectedItem}
                    getItemProps={getItemProps}
                  />
                </div>
              ) : null}
            </div>
          );
        }}
      </Downshift>
    </>
  );
};

export const AsyncSelectNG: FC<AsyncSelectNGProps> = ({ loadOptions, placeholder, noOptionsMessage }) => {
  const [currentValue, setCurrentValue] = useState<string | null>();
  const inputRef = React.createRef<HTMLInputElement>();
  const onLoadOptions = useRef<any>(null);

  if (!onLoadOptions.current) {
    onLoadOptions.current = debounce(
      async (inputValue: string | null) => {
        return await loadOptions(inputValue);
      },
      300,
      { leading: false }
    );
  }
  return (
    <>
      <Downshift
        itemToString={(value: SelectableValue<any> | null) => value?.label || ''}
        onInputValueChange={v => {
          console.log(v);
          setCurrentValue(v);
        }}
      >
        {({
          getInputProps,
          getToggleButtonProps,
          getMenuProps,
          getItemProps,
          isOpen,
          highlightedIndex,
          selectedItem,
          inputValue,
          openMenu,
        }) => {
          const dropdownButton = (
            <IconButton
              name="arrow-down"
              {...getToggleButtonProps({
                onClick: () => {
                  if (!isOpen) {
                    inputRef.current?.focus();
                  }
                },
              })}
              aria-label={'toggle menu'}
            />
          );

          return (
            <div>
              <Input
                {...getInputProps()}
                ref={inputRef}
                type="text"
                placeholder={placeholder || 'Select value...'}
                // value={selectedItem ? selectedItem.label : undefined}
                suffix={dropdownButton}
              />
              {isOpen ? (
                <Fetch<any, Array<SelectableValue<any>>> loadData={onLoadOptions.current} args={currentValue}>
                  {state => {
                    if (state.error) {
                      return <div>Error loading data...</div>;
                    }
                    if (state.loading) {
                      return <div>Loading data...</div>;
                    }

                    if (state.value && state.value.length === 0) {
                      return <div>{noOptionsMessage}</div>;
                    }
                    if (state.value) {
                      return (
                        <SelectMenu
                          {...getMenuProps()}
                          options={state.value}
                          highlightedIndex={highlightedIndex}
                          selectedItem={selectedItem}
                          getItemProps={getItemProps}
                        />
                      );
                    }

                    return <></>;
                  }}
                </Fetch>
              ) : null}
            </div>
          );
        }}
      </Downshift>
    </>
  );
};

interface SelectMenuProps {
  maxHeight?: number;
  options: Array<SelectableValue<any>>;
  getItemProps: (options: GetItemPropsOptions<SelectableValue<any>>) => any;
  highlightedIndex: number;
  selectedItem: SelectableValue<any>;
}

const SelectMenu = React.forwardRef<HTMLDivElement, SelectMenuProps>((props, ref) => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);

  const { maxHeight = 300, options, highlightedIndex, selectedItem, ...otherProps } = props;

  return (
    <div className={styles.menu} style={{ maxHeight }} {...otherProps} ref={ref}>
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {options.map((o, index) => {
          const itemProps = props.getItemProps({
            key: o.value,
            index,
            item: o,
          });
          return (
            <SelectMenuOptions
              data={o}
              {...itemProps}
              isFocused={highlightedIndex === index}
              isSelected={selectedItem === o}
            />
          );
        })}
      </CustomScrollbar>
    </div>
  );
});

SelectMenu.displayName = 'SelectMenu';

interface SelectMenuOptionProps<T> {
  isDisabled?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOptions: FC<SelectMenuOptionProps<any>> = props => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children, data, renderOptionLabel, isSelected, isFocused, ...otherProps } = props;

  return (
    <div {...otherProps} className={cx(styles.option, isFocused && styles.optionFocused)}>
      {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} />}
      <div className={styles.optionBody}>
        <span>{renderOptionLabel ? renderOptionLabel(data) : data.label}</span>
        {data.description && <div className={styles.optionDescription}>{data.description}</div>}
      </div>
      {isSelected && (
        <span>
          <Icon name="check" />
        </span>
      )}
    </div>
  );
};
