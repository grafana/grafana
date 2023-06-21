import { cx } from '@emotion/css';
import { max } from 'lodash';
import React, { RefCallback } from 'react';
import { MenuListProps } from 'react-select';
import { FixedSizeList as List } from 'react-window';

import { SelectableValue, toIconName } from '@grafana/data';

import { useTheme2 } from '../../themes/ThemeContext';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Icon } from '../Icon/Icon';

import { getSelectStyles } from './getSelectStyles';

interface SelectMenuProps {
  maxHeight: number;
  innerRef: RefCallback<HTMLDivElement>;
  innerProps: {};
}

export const SelectMenu = ({ children, maxHeight, innerRef, innerProps }: React.PropsWithChildren<SelectMenuProps>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);

  return (
    <div {...innerProps} className={styles.menu} style={{ maxHeight }} aria-label="Select options menu">
      <CustomScrollbar scrollRefCallback={innerRef} autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {children}
      </CustomScrollbar>
    </div>
  );
};

SelectMenu.displayName = 'SelectMenu';

const VIRTUAL_LIST_ITEM_HEIGHT = 37;
const VIRTUAL_LIST_WIDTH_ESTIMATE_MULTIPLIER = 7;

// A virtualized version of the SelectMenu, descriptions for SelectableValue options not supported since those are of a variable height.
//
// To support the virtualized list we have to "guess" the width of the menu container based on the longest available option.
// the reason for this is because all of the options will be positioned absolute, this takes them out of the document and no space
// is created for them, thus the container can't grow to accomodate.
//
// VIRTUAL_LIST_ITEM_HEIGHT and WIDTH_ESTIMATE_MULTIPLIER are both magic numbers.
// Some characters (such as emojis and other unicode characters) may consist of multiple code points in which case the width would be inaccurate (but larger than needed).
export const VirtualizedSelectMenu = ({ children, maxHeight, options, getValue }: MenuListProps<SelectableValue>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const [value] = getValue();

  const valueIndex = value ? options.findIndex((option: SelectableValue<unknown>) => option.value === value.value) : 0;
  const initialOffset = valueIndex * VIRTUAL_LIST_ITEM_HEIGHT;

  if (!Array.isArray(children)) {
    return null;
  }

  const longestOption = max(options.map((option) => option.label?.length)) ?? 0;
  const widthEstimate = longestOption * VIRTUAL_LIST_WIDTH_ESTIMATE_MULTIPLIER;
  const heightEstimate = Math.min(options.length * VIRTUAL_LIST_ITEM_HEIGHT, maxHeight);

  return (
    <List
      className={styles.menu}
      height={heightEstimate}
      width={widthEstimate}
      aria-label="Select options menu"
      itemCount={children.length}
      itemSize={VIRTUAL_LIST_ITEM_HEIGHT}
      initialScrollOffset={initialOffset}
    >
      {({ index, style }) => <div style={{ ...style, overflow: 'hidden' }}>{children[index]}</div>}
    </List>
  );
};

VirtualizedSelectMenu.displayName = 'VirtualizedSelectMenu';

interface SelectMenuOptionProps<T> {
  isDisabled: boolean;
  isFocused: boolean;
  isSelected: boolean;
  innerProps: JSX.IntrinsicElements['div'];
  innerRef: RefCallback<HTMLDivElement>;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOptions = ({
  children,
  data,
  innerProps,
  innerRef,
  isFocused,
  isSelected,
  renderOptionLabel,
}: React.PropsWithChildren<SelectMenuOptionProps<any>>) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const icon = data.icon ? toIconName(data.icon) : undefined;
  // We are removing onMouseMove and onMouseOver from innerProps because they cause the whole
  // list to re-render everytime the user hovers over an option. This is a performance issue.
  // See https://github.com/JedWatson/react-select/issues/3128#issuecomment-451936743
  const { onMouseMove, onMouseOver, ...rest } = innerProps;

  return (
    <div
      ref={innerRef}
      className={cx(
        styles.option,
        isFocused && styles.optionFocused,
        isSelected && styles.optionSelected,
        data.isDisabled && styles.optionDisabled
      )}
      {...rest}
      aria-label="Select option"
      title={data.title}
    >
      {icon && <Icon name={icon} className={styles.optionIcon} />}
      {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} alt={data.label || data.value} />}
      <div className={styles.optionBody}>
        <span>{renderOptionLabel ? renderOptionLabel(data) : children}</span>
        {data.description && <div className={styles.optionDescription}>{data.description}</div>}
        {data.component && <data.component />}
      </div>
    </div>
  );
};

SelectMenuOptions.displayName = 'SelectMenuOptions';
