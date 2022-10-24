import { cx, css } from '@emotion/css';
import React, { forwardRef, ButtonHTMLAttributes } from 'react';

import { GrafanaTheme2, IconName, isIconName } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { styleMixins, useStyles2 } from '../../themes';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { getPropertiesForVariant } from '../Button';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

type CommonProps = {
  /** Icon name */
  icon?: IconName | React.ReactNode;
  /** Tooltip */
  tooltip?: string;
  /** For image icons */
  imgSrc?: string;
  /** Alt text for imgSrc */
  imgAlt?: string;
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
  /** Show highlight dot */
  isHighlighted?: boolean;
};

export type ToolbarButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export type ToolbarButtonVariant = 'default' | 'primary' | 'destructive' | 'active' | 'canvas';

export const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(
  (
    {
      tooltip,
      icon,
      className,
      children,
      imgSrc,
      imgAlt,
      fullWidth,
      isOpen,
      narrow,
      variant = 'default',
      iconOnly,
      'aria-label': ariaLabel,
      isHighlighted,
      ...rest
    },
    ref
  ) => {
    const styles = useStyles2(getStyles);

    const buttonStyles = cx(
      {
        [styles.button]: true,
        [styles.buttonFullWidth]: fullWidth,
        [styles.narrow]: narrow,
      },
      styles[variant],
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
        aria-label={getButtonAriaLabel(ariaLabel, tooltip)}
        aria-expanded={isOpen}
        {...rest}
      >
        {renderIcon(icon)}
        {imgSrc && <img className={styles.img} src={imgSrc} alt={imgAlt ?? ''} />}
        {children && !iconOnly && <div className={contentStyles}>{children}</div>}
        {isOpen === false && <Icon name="angle-down" />}
        {isOpen === true && <Icon name="angle-up" />}
        {isHighlighted && <div className={styles.highlight} />}
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

ToolbarButton.displayName = 'ToolbarButton';

function getButtonAriaLabel(ariaLabel: string | undefined, tooltip: string | undefined) {
  return ariaLabel ? ariaLabel : tooltip ? selectors.components.PageToolbar.item(tooltip) : undefined;
}

function renderIcon(icon: IconName | React.ReactNode) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size="lg" />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  const primaryVariant = getPropertiesForVariant(theme, 'primary', 'solid');
  const destructiveVariant = getPropertiesForVariant(theme, 'destructive', 'solid');

  const defaultOld = css`
    color: ${theme.colors.text.secondary};
    background-color: ${theme.colors.background.primary};

    &:hover {
      color: ${theme.colors.text.primary};
      background: ${theme.colors.background.secondary};
    }
  `;

  const defaultTopNav = css`
    color: ${theme.colors.text.secondary};
    background-color: transparent;
    border-color: transparent;

    &:hover {
      color: ${theme.colors.text.primary};
      background: ${theme.colors.background.secondary};
    }
  `;

  return {
    button: css`
      label: toolbar-button;
      position: relative;
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
    default: theme.flags.topnav ? defaultTopNav : defaultOld,
    canvas: defaultOld,
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
    highlight: css`
      background-color: ${theme.colors.success.main};
      border-radius: 50%;
      width: 6px;
      height: 6px;
      position: absolute;
      top: -3px;
      right: -3px;
      z-index: 1;
    `,
  };
};
