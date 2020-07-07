import React from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
import { cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { Icon } from '../Icon/Icon';
import { CustomScrollbar } from '../CustomScrollbar/CustomScrollbar';

interface SelectMenuProps {
  maxHeight: number;
  innerRef: React.Ref<any>;
  innerProps: {};
}

export const SelectMenu = React.forwardRef<HTMLDivElement, React.PropsWithChildren<SelectMenuProps>>((props, ref) => {
  const theme = useTheme();
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
    const theme = useTheme();
    const styles = getSelectStyles(theme);
    const { children, innerProps, data, renderOptionLabel, isSelected, isFocused } = props;

    return (
      <div
        ref={ref}
        className={cx(styles.option, isFocused && styles.optionFocused)}
        {...innerProps}
        aria-label="Select option"
      >
        {data.imgUrl && <img className={styles.optionImage} src={data.imgUrl} />}
        <div className={styles.optionBody}>
          <span>{renderOptionLabel ? renderOptionLabel(data) : children}</span>
          {data.description && <div className={styles.optionDescription}>{data.description}</div>}
        </div>
        {isSelected && (
          <span>
            <Icon name="check" />
          </span>
        )}
      </div>
    );
  }
);
