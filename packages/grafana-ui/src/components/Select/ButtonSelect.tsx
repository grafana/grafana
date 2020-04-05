import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

import { Button, ButtonVariant, ButtonProps } from '../Button';
import { ComponentSize } from '../../types/size';
import { SelectCommonProps, CustomControlProps } from './types';
import { SelectBase } from './SelectBase';
import { stylesFactory, useTheme } from '../../themes';
import { Icon } from '../Icon/Icon';
import { IconName } from '../../types';

interface ButtonSelectProps<T> extends Omit<SelectCommonProps<T>, 'renderControl' | 'size' | 'prefix'> {
  icon?: IconName;
  variant?: ButtonVariant;
  size?: ComponentSize;
}

interface SelectButtonProps extends Omit<ButtonProps, 'icon'> {
  icon?: IconName;
  isOpen?: boolean;
}

const SelectButton = React.forwardRef<HTMLButtonElement, SelectButtonProps>(
  ({ icon, children, isOpen, ...buttonProps }, ref) => {
    const getStyles = stylesFactory((theme: GrafanaTheme) => ({
      wrapper: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        max-width: 200px;
        text-overflow: ellipsis;
      `,
      iconWrap: css`
        padding: 0 15px 0 0;
      `,
      caretWrap: css`
        padding-left: ${theme.spacing.sm};
        margin-left: ${theme.spacing.sm};
        margin-right: -${theme.spacing.sm};
        height: 100%;
      `,
    }));
    const styles = getStyles(useTheme());
    return (
      <Button {...buttonProps} ref={ref} icon={icon}>
        <span className={styles.wrapper}>
          <span>{children}</span>
          <span className={styles.caretWrap}>
            <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
          </span>
        </span>
      </Button>
    );
  }
);

export function ButtonSelect<T>({
  placeholder,
  icon,
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...selectProps
}: ButtonSelectProps<T>) {
  const buttonProps = {
    icon,
    variant,
    size,
    className,
    disabled,
  };

  return (
    <SelectBase
      {...selectProps}
      renderControl={React.forwardRef<any, CustomControlProps<T>>(({ onBlur, onClick, value, isOpen }, ref) => {
        return (
          <SelectButton {...buttonProps} ref={ref} onBlur={onBlur} onClick={onClick} isOpen={isOpen}>
            {value ? value.label : placeholder}
          </SelectButton>
        );
      })}
    />
  );
}
