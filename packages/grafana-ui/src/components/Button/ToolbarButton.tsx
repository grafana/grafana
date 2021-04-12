import React, { forwardRef, ButtonHTMLAttributes } from 'react';
import { cx, css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, useStyles } from '../../themes';
import { IconName } from '../../types/icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { Icon } from '../Icon/Icon';
import { getPropertiesForVariant } from './Button';
import { isString } from 'lodash';
import { selectors } from '@grafana/e2e-selectors';

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
      <button ref={ref} className={buttonStyles} aria-label={getButttonAriaLabel(ariaLabel, tooltip)} {...rest}>
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

const getStyles = (theme: GrafanaTheme) => {
  const primaryVariant = getPropertiesForVariant(theme.v2, 'primary');
  const destructiveVariant = getPropertiesForVariant(theme.v2, 'destructive');

  return {
    button: css`
      label: toolbar-button;
      display: flex;
      align-items: center;
      height: ${theme.v2.spacing(theme.v2.components.height.md)};
      padding: ${theme.v2.spacing(0, 1)};
      border-radius: ${theme.v2.shape.borderRadius()};
      line-height: ${theme.v2.components.height.md * theme.v2.spacing.gridSize - 2}px;
      font-weight: ${theme.v2.typography.fontWeightMedium};
      border: 1px solid ${theme.v2.palette.border1};      
      white-space: nowrap;
      transition: ${theme.v2.transitions.create(['background', 'box-shadow', 'border-color', 'color'], {
        duration: theme.v2.transitions.duration.short,
      })},

      &:focus {
        outline: none;
      }

      &:hover {
        box-shadow: ${theme.v2.shadows.z2};
      }

      &[disabled],
      &:disabled {
        cursor: not-allowed;
        opacity: ${theme.v2.palette.action.disabledOpacity};
        background: ${theme.v2.palette.action.disabledBackground};
        box-shadow: none;

        &:hover {
          color: ${theme.v2.palette.text.disabled};
          background: ${theme.v2.palette.action.disabledBackground};
          box-shadow: none;
        }
      }      
    `,
    default: css`
      color: ${theme.v2.palette.text.secondary};
      background-color: ${theme.v2.palette.layer1};

      &:hover {
        color: ${theme.v2.palette.text.primary};
        background: ${theme.v2.palette.layer2};
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
    primary: css(primaryVariant),
    destructive: css(destructiveVariant),
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
    `,
    contentWithIcon: css`
      display: none;
      padding-left: ${theme.spacing.sm};

      @media ${styleMixins.mediaUp(theme.breakpoints.md)} {
        display: block;
      }
    `,
    contentWithRightIcon: css`
      padding-right: ${theme.spacing.xs};
    `,
  };
};
