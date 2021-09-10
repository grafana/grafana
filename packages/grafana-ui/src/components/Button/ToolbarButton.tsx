import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cx, css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { styleMixins, useStyles2 } from '../../themes';
import { IconName } from '../../types/icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { getPropertiesForVariant } from './Button';
import { isString } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';

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
    {
      tooltip,
      icon,
      className,
      children,
      imgSrc,
      fullWidth,
      isOpen,
      narrow,
      variant = 'default',
      iconOnly,
      'aria-label': ariaLabel,
      ...rest
    },
    ref
  ) => {
    const styles = useStyles2(getStyles);

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
      <button
        ref={ref}
        className={buttonStyles}
        aria-label={getButttonAriaLabel(ariaLabel, tooltip)}
        aria-expanded={isOpen}
        {...rest}
      >
        {renderIcon(icon)}
        {imgSrc && <img className={styles.img} src={imgSrc} />}
        {children && !iconOnly && <div className={contentStyles}>{children}</div>}
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

function getButttonAriaLabel(ariaLabel: string | undefined, tooltip: string | undefined) {
  return ariaLabel ? ariaLabel : tooltip ? selectors.components.PageToolbar.item(tooltip) : undefined;
}

function renderIcon(icon: IconName | React.ReactNode) {
  if (!icon) {
    return null;
  }

  if (isString(icon)) {
    return <Icon name={icon as IconName} size={'lg'} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  const primaryVariant = getPropertiesForVariant(theme, 'primary', 'solid');
  const destructiveVariant = getPropertiesForVariant(theme, 'destructive', 'solid');

  return {
    button: css`
      label: toolbar-button;
      display: flex;
      align-items: center;
      height: ${theme.spacing(theme.components.height.md)};
      padding: ${theme.spacing(0, 1)};
      border-radius: ${theme.shape.borderRadius()};
      line-height: ${theme.components.height.md * theme.spacing.gridSize - 2}px;
      font-weight: ${theme.typography.fontWeightMedium};
      border: 1px solid ${theme.colors.border.weak};
      white-space: nowrap;
      transition: ${theme.transitions.create(['background', 'box-shadow', 'border-color', 'color'], {
        duration: theme.transitions.duration.short,
      })};

      &:focus,
      &:focus-visible {
        ${getFocusStyles(theme)}
        z-index: 1;
      }

      &:focus:not(:focus-visible) {
        ${getMouseFocusStyles(theme)}
      }

      &:hover {
        box-shadow: ${theme.shadows.z1};
      }

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: ${theme.colors.action.disabledOpacity};
        background: ${theme.colors.action.disabledBackground};
        box-shadow: none;

        &:hover {
          color: ${theme.colors.text.disabled};
          background: ${theme.colors.action.disabledBackground};
          box-shadow: none;
        }
      }
    `,
    default: css`
      color: ${theme.colors.text.secondary};
      background-color: ${theme.colors.background.primary};

      &:hover {
        color: ${theme.colors.text.primary};
        background: ${theme.colors.background.secondary};
      }
    `,
    active: css`
      color: ${theme.v1.palette.orangeDark};
      border-color: ${theme.v1.palette.orangeDark};
      background-color: transparent;

      &:hover {
        color: ${theme.colors.text.primary};
        background: ${theme.colors.emphasize(theme.colors.background.canvas, 0.03)};
      }
    `,
    primary: css(primaryVariant),
    destructive: css(destructiveVariant),
    narrow: css`
      padding: 0 ${theme.spacing(0.5)};
    `,
    img: css`
      width: 16px;
      height: 16px;
      margin-right: ${theme.spacing(1)};
    `,
    buttonFullWidth: css`
      flex-grow: 1;
    `,
    content: css`
      flex-grow: 1;
    `,
    contentWithIcon: css`
      display: none;
      padding-left: ${theme.spacing(1)};

      @media ${styleMixins.mediaUp(theme.v1.breakpoints.md)} {
        display: block;
      }
    `,
    contentWithRightIcon: css`
      padding-right: ${theme.spacing(0.5)};
    `,
  };
};
