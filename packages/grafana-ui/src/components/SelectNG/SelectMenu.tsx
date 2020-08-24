import React from 'react';
import { cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { useStyles, useTheme } from '../../themes';
import { getSelectStyles } from '../Select/getSelectStyles';
import { CustomScrollbar, Icon } from '..';
import { GetItemPropsOptions } from 'downshift';
import { selectors } from '@grafana/e2e-selectors';
import { shouldAllowOptionCreate } from './utils';

interface SelectMenuProps {
  maxHeight?: number;
  options: SelectableValue[];
  getItemProps: (options: GetItemPropsOptions<SelectableValue>) => any;
  highlightedIndex: number;
  selectedItem: SelectableValue;
  renderOption: (
    o: SelectableValue,
    getItemProps: (options: GetItemPropsOptions<any>) => any,
    index: number,
    highlightedIndex: number
  ) => React.ReactNode;
  enableOptionCreation?: boolean;
  onOptionCreate?: (value: SelectableValue) => void;
  inputValue?: string;
}

// This is pretty much the same implementation as current's Select menu, apart from react-select specific props (innerRef, innerProps)
export const SelectMenu = React.forwardRef<HTMLDivElement, SelectMenuProps>((props, ref) => {
  const {
    maxHeight = 300,
    options,
    highlightedIndex,
    selectedItem,
    getItemProps,
    enableOptionCreation,
    onOptionCreate,
    inputValue,
    renderOption,
    ...otherProps
  } = props;
  const styles = useStyles(getSelectStyles);

  let groupLengthAggr = 0;
  let flatOptionsLengthAggr = 0;
  // Maps options so SelectMenuOption components
  const optionElements = options.map((o, index) => {
    const itemPropsGetter = (options: GetItemPropsOptions<any>) =>
      getItemProps({
        'aria-label': selectors.components.Select.option,
        key: o.value,
        isSelected: o === selectedItem,
        ...options,
        //  disabled: TODO
      });

    const optionEl = renderOption(o, itemPropsGetter, index + groupLengthAggr, highlightedIndex);

    if (o.options) {
      groupLengthAggr += o.options.length - 1; // -1 to compensate indexing from 0
    } else {
      flatOptionsLengthAggr += 1;
    }

    return optionEl;
  });

  // When creating custom options is enabled append link to do so
  if (enableOptionCreation && shouldAllowOptionCreate(options, inputValue)) {
    const newItem = { value: inputValue, label: inputValue };
    console.log(flatOptionsLengthAggr);
    const itemProps = getItemProps({
      key: inputValue,
      item: newItem,
      index: groupLengthAggr + flatOptionsLengthAggr,
    });

    optionElements.push(
      <SelectMenuOption
        {...itemProps}
        key="custom-options"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          if (onOptionCreate) {
            onOptionCreate(newItem);
          }
          itemProps.onClick(e);
        }}
        isFocused={highlightedIndex === options.length}
        item={{ value: inputValue, label: `Create: ${inputValue}` }}
      />
    );
  }

  return (
    <div
      className={styles.menu}
      style={{ maxHeight }}
      {...otherProps}
      ref={ref}
      aria-label={selectors.components.Select.menu}
    >
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {optionElements}
      </CustomScrollbar>
    </div>
  );
});

SelectMenu.displayName = 'SelectMenu';

interface SelectMenuOptionProps<T> extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  isFocused?: boolean;
  isSelected?: boolean;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  item: SelectableValue<T>;
}

export const SelectMenuOption: React.FC<SelectMenuOptionProps<any>> = props => {
  const theme = useTheme();
  const styles = getSelectStyles(theme);
  const { children, item, renderOptionLabel, isSelected, isFocused, ...otherProps } = props;
  return (
    <div {...otherProps} className={cx(styles.option, isFocused && styles.optionFocused)}>
      {item.imgUrl && <img className={styles.optionImage} src={item.imgUrl} />}
      <div className={styles.optionBody}>
        <span>{renderOptionLabel ? renderOptionLabel(item) : item.label}</span>
        {item.description && (
          <div className={styles.optionDescription} aria-label={selectors.components.Select.optionDescription}>
            {item.description}
          </div>
        )}
      </div>
      {isSelected && (
        <span>
          <Icon name="check" />
        </span>
      )}
    </div>
  );
};

SelectMenuOption.displayName = 'SelectMenuOption';

interface SelectMenuMessageProps {
  text: string;
}
export const SelectMenuMessage: React.FC<SelectMenuMessageProps> = ({ text }) => {
  const styles = useStyles(getSelectStyles);
  return (
    <div className={styles.menu}>
      <div className={styles.loadingMessage}>{text}</div>
    </div>
  );
};
