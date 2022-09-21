import { cx } from '@emotion/css';
import React, { FC, RefCallback } from 'react';

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

export const SelectMenu: FC<SelectMenuProps> = ({ children, maxHeight, innerRef, innerProps }) => {
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

interface SelectMenuOptionProps<T> {
  isDisabled: boolean;
  isFocused: boolean;
  isSelected: boolean;
  innerProps: JSX.IntrinsicElements['div'];
  innerRef: RefCallback<HTMLDivElement>;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOptions: FC<SelectMenuOptionProps<any>> = ({
  children,
  data,
  innerProps,
  innerRef,
  isFocused,
  isSelected,
  renderOptionLabel,
}) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const icon = data.icon ? toIconName(data.icon) : undefined;

  return (
    <div
      ref={innerRef}
      className={cx(
        styles.option,
        isFocused && styles.optionFocused,
        isSelected && styles.optionSelected,
        data.isDisabled && styles.optionDisabled
      )}
      {...innerProps}
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
