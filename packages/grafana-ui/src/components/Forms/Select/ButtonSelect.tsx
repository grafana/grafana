import React from 'react';

import { Button, ButtonVariant, ButtonProps } from '../Button';
import { ButtonSize } from '../../Button/types';
import { SelectCommonProps, SelectBase, CustomControlProps } from './SelectBase';
import { css } from 'emotion';
import { useTheme } from '../../../themes';
import { Icon } from '../../Icon/Icon';
import { IconType } from '../../Icon/types';

interface ButtonSelectProps<T> extends Omit<SelectCommonProps<T>, 'renderControl' | 'size' | 'prefix'> {
  icon?: IconType;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

interface SelectButtonProps extends Omit<ButtonProps, 'icon'> {
  icon?: IconType;
  isOpen?: boolean;
  innerRef: any;
}

const SelectButton: React.FC<SelectButtonProps> = ({ icon, children, isOpen, innerRef, ...buttonProps }) => {
  const theme = useTheme();
  const styles = {
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
  };
  const buttonIcon = `fa fa-${icon}`;
  const caretIcon = isOpen ? 'caret-up' : 'caret-down';
  return (
    <Button {...buttonProps} ref={innerRef} icon={buttonIcon}>
      <span className={styles.wrapper}>
        <span>{children}</span>
        <span className={styles.caretWrap}>
          <Icon name={caretIcon} />
        </span>
      </span>
    </Button>
  );
};

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
          <SelectButton {...buttonProps} innerRef={ref} onBlur={onBlur} onClick={onClick} isOpen={isOpen}>
            {value ? value.label : placeholder}
          </SelectButton>
        );
      })}
    />
  );
}
