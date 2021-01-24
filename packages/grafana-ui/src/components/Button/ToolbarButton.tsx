import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cx, css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, useStyles } from '../../themes';
import { IconName } from '../../types/icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { getPropertiesForVariant } from './Button';
import { isString } from 'lodash';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon name */
  icon?: IconName | React.ReactNode;
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
  variant?: ToolbarButtonVariant;
  /** Hide any children and only show icon */
  iconOnly?: boolean;
}

export type ToolbarButtonVariant = 'default' | 'primary' | 'destructive' | 'active';

export const ToolbarButton = forwardRef<HTMLButtonElement, Props>(
  (
    { tooltip, icon, className, children, imgSrc, fullWidth, isOpen, narrow, variant = 'default', iconOnly, ...rest },
    ref
  ) => {
    const styles = useStyles(getStyles);

    const buttonStyles = cx(
      'toolbar-button',
      {
        [styles.button]: true,
        [styles.buttonFullWidth]: fullWidth,
        [styles.narrow]: narrow,
      },
      (styles as any)[variant],
      className
    );

    const contentStyles = cx({
      [styles.content]: true,
      [styles.contentWithIcon]: !!icon,
      [styles.contentWithRightIcon]: isOpen !== undefined,
    });

    const body = (
      <button ref={ref} className={buttonStyles} {...rest}>
        {renderIcon(icon)}
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

function renderIcon(icon: IconName | React.ReactNode) {
  if (!icon) {
    return null;
  }

  if (isString(icon)) {
    return <Icon name={icon as IconName} size={'lg'} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme) => {
  const primaryVariant = getPropertiesForVariant(theme, 'primary');
  const destructiveVariant = getPropertiesForVariant(theme, 'destructive');

  return {
    button: css`
      label: toolbar-button;
      display: flex;
      align-items: center;
      height: ${theme.height.md}px;
      padding: 0 ${theme.spacing.sm};
      border-radius: ${theme.border.radius.sm};
      line-height: ${theme.height.md - 2}px;
      font-weight: ${theme.typography.weight.semibold};
      border: 1px solid ${theme.colors.border2};

      &:focus {
        outline: none;
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
    default: css`
      color: ${theme.colors.textWeak};
      background-color: ${theme.colors.bg1};

      &:hover {
        color: ${theme.colors.text};
        background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
      }
    `,
    active: css`
      color: ${theme.palette.orangeDark};
      border-color: ${theme.palette.orangeDark};
      background-color: transparent;

      &:hover {
        color: ${theme.colors.text};
        background: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
      }
    `,
    primary: css`
      border-color: ${primaryVariant.borderColor};
      ${primaryVariant.variantStyles}
    `,
    destructive: css`
      border-color: ${destructiveVariant.borderColor};
      ${destructiveVariant.variantStyles}
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
  };
};
