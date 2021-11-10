import React from 'react';
import { useTheme2 } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
import { cx } from '@emotion/css';
import { SelectableValue } from '@grafana/data';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

interface SelectMenuProps {
  maxHeight: number;
  innerRef: React.Ref<any>;
  innerProps: {};
}

export const SelectMenu = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuProps>>((props, ref) => {
  const theme = useTheme2();
  const styles = getSelectStyles(theme);
  const { children, maxHeight, innerRef, innerProps } = props;

  return (
    <div {...innerProps} className={styles.menu} ref={innerRef} style={{ maxHeight }} aria-label="Select options menu">
      <CustomScrollbar autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
        {children}
      </CustomScrollbar>
    </div>
  );
});

SelectMenu.displayName = 'SelectMenu';

interface SelectMenuOptionProps<T> {
  isDisabled: boolean;
  isFocused: boolean;
  isSelected: boolean;
  innerProps: any;
  renderOptionLabel?: (value: SelectableValue<T>) => JSX.Element;
  data: SelectableValue<T>;
}

export const SelectMenuOptions = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuOptionProps<any>>>(
  (props, ref) => {
    const theme = useTheme2();
    const styles = getSelectStyles(theme);
    const { children, innerProps, data, renderOptionLabel, isSelected, isFocused } = props;

    return (
      <div
        ref={ref}
        className={cx(
          styles.option,
          isFocused && styles.optionFocused,
          isSelected && styles.optionSelected,
          data.isDisabled && styles.optionDisabled
        )}
        {...innerProps}
        aria-label="Select option"
      >
        {data.icon && <Icon name={data.icon as IconName} className={styles.optionIcon} />}
        {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} alt={data.label || data.value} />}
        <div className={styles.optionBody}>
          <span>{renderOptionLabel ? renderOptionLabel(data) : children}</span>
          {data.description && <div className={styles.optionDescription}>{data.description}</div>}
          {data.component && <data.component />}
        </div>
      </div>
    );
  }
);

SelectMenuOptions.displayName = 'SelectMenuOptions';
