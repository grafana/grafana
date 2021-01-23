import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, useStyles } from '../../themes';
import { IconName } from '../../types/icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { ButtonVariant, getPropertiesForVariant } from './Button';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name */
  icon?: IconName;
  /** Tooltip */
  tooltip?: string;
  /** For image icons */
  imgSrc?: string;
  /** if true or false will show angle-down/up */
  isOpen?: boolean;
  /** Controls flex-grow: 1 */
  fullWidth?: boolean;
  /** reduces padding to xs */
  narrow?: boolean;
  /** variant */
  variant?: ButtonVariant;
  /** Changes border color to orange */
  active?: boolean;
  /** Hide any children and only show icon */
  iconOnly?: boolean;
}

export const ToolbarButton = forwardRef<HTMLButtonElement, Props>(
  (
    { tooltip, icon, className, children, imgSrc, fullWidth, isOpen, narrow, variant, active, iconOnly, ...rest },
    ref
  ) => {
    const styles = useStyles(getStyles);

    const buttonStyles = cx(
      'toolbar-button',
      {
        [styles.button]: true,
        [styles.buttonFullWidth]: fullWidth,
        [styles.narrow]: narrow,
        [styles.primaryVariant]: variant === 'primary',
        [styles.destructiveVariant]: variant === 'destructive',
        [styles.active]: active,
      },
      className
    );

    const contentStyles = cx({
      [styles.content]: true,
      [styles.contentWithIcon]: !!icon,
      [styles.contentWithRightIcon]: isOpen !== undefined,
    });

    const body = (
      <button ref={ref} className={buttonStyles} {...rest}>
        {icon && <Icon name={icon} size={'lg'} />}
        {imgSrc && <img className={styles.img} src={imgSrc} />}
        {children && !iconOnly && <span className={contentStyles}>{children}</span>}
        {isOpen === false && <Icon name="angle-down" />}
        {isOpen === true && <Icon name="angle-up" />}
      </button>
    );

    return tooltip ? (
      <Tooltip content={tooltip} placement="bottom">
        {body}
      </Tooltip>
    ) : (
      body
    );
  }
);

const getStyles = (theme: GrafanaTheme) => {
  const primaryVariant = getPropertiesForVariant(theme, 'primary');
  const destructiveVariant = getPropertiesForVariant(theme, 'destructive');

  return {
    button: css`
      label: toolbar-button;
      background: ${theme.colors.bg1};
      border: 1px solid ${theme.colors.border2};
      height: ${theme.height.md}px;
      padding: 0 ${theme.spacing.sm};
      color: ${theme.colors.textWeak};
      border-radius: ${theme.border.radius.sm};
      line-height: ${theme.height.md - 2}px;
      font-weight: ${theme.typography.weight.semibold};
      display: flex;
      align-items: center;

      &:focus {
        outline: none;
      }

      &:hover {
        color: ${theme.colors.text};
        background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
      }

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: 0.5;

        &:hover {
          color: ${theme.colors.textWeak};
          background: ${theme.colors.bg1};
        }
      }
    `,
    active: css`
      color: ${theme.palette.orangeDark};
      border-color: ${theme.palette.orangeDark};
      background-color: transparent;
    `,
    narrow: css`
      padding: 0 ${theme.spacing.xs};
    `,
    img: css`
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing.sm};
    `,
    buttonFullWidth: css`
      flex-grow: 1;
    `,
    content: css`
      flex-grow: 1;
      display: none;

      @media only screen and (min-width: ${theme.breakpoints.md}) {
        display: block;
      }
    `,
    contentWithIcon: css`
      padding-left: ${theme.spacing.sm};
    `,
    contentWithRightIcon: css`
      padding-right: ${theme.spacing.xs};
    `,
    primaryVariant: css`
      border-color: ${primaryVariant.borderColor};
      ${primaryVariant.variantStyles}
    `,
    destructiveVariant: css`
      border-color: ${destructiveVariant.borderColor};
      ${destructiveVariant.variantStyles}
    `,
  };
};
