import React, { RefObject, PropsWithChildren, forwardRef } from 'react';
import { useTheme } from '../../../themes/ThemeContext';
import { getSelectStyles } from './getSelectStyles';
import { cx } from 'emotion';
import { SelectableValue } from '@grafana/data';
import { Icon } from '../../Icon/Icon';
import { CustomScrollbar } from '../../CustomScrollbar/CustomScrollbar';
import { ExtendedOptionProps } from '../../Select/SelectOption';
import Scrollbars from 'react-custom-scrollbars';

interface SelectMenuProps {
  maxHeight: number;
  innerRef: React.Ref<any>;
  innerProps: {};
  scrollRef: RefObject<Scrollbars>;
}

export const SelectMenu = forwardRef<HTMLDivElement, PropsWithChildren<SelectMenuProps & ExtendedOptionProps>>(
  (props, ref = props.innerRef) => {
    const theme = useTheme();
    const styles = getSelectStyles(theme);
    const { children, maxHeight, innerProps, scrollRef } = props;

    return (
      <div {...innerProps} className={styles.menu} ref={ref} style={{ maxHeight }} aria-label="Select options menu">
        <CustomScrollbar scrollRef={scrollRef} autoHide={false} autoHeightMax="inherit" hideHorizontalTrack>
          {children}
        </CustomScrollbar>
      </div>
    );
  }
);

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
        <span>{renderOptionLabel ? renderOptionLabel(data) : children}</span>
        {isSelected && (
          <span>
            <Icon name="check" />
          </span>
        )}
      </div>
    );
  }
);
