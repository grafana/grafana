import { css, cx } from '@emotion/css';
import React, { ButtonHTMLAttributes, useContext } from 'react';

import { GrafanaTheme2, IconName, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { IconSize } from '../../types/icon';
import { getActiveButtonStyles } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

import { SidebarContext } from './useSidebar';

export interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  active?: boolean;
  tooltip?: string;
  title: string;
  iconSize?: IconSize;
  iconColor?: string;
}

export const SidebarButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ icon, active, onClick, title, tooltip, iconSize, iconColor, ...restProps }, ref) => {
    const styles = useStyles2(getStyles);
    const context = useContext(SidebarContext);

    if (!context) {
      throw new Error('Sidebar.Button must be used within a Sidebar component');
    }

    const buttonClass = cx(
      styles.button,
      context.compact && styles.compact,
      context.position === 'left' && styles.leftButton
    );

    return (
      <Tooltip ref={ref} content={tooltip ?? title} placement={context.position === 'left' ? 'right' : 'left'}>
        <button
          className={buttonClass}
          aria-label={title}
          aria-expanded={active}
          type="button"
          onClick={onClick}
          {...restProps}
        >
          <div className={cx(styles.iconWrapper, iconColor, active ? styles.iconActive : '')}>
            {renderIcon(icon, iconSize)}
          </div>
          {!context.compact && <div className={cx(styles.title, active && styles.titleActive)}>{title}</div>}
        </button>
      </Tooltip>
    );
  }
);

SidebarButton.displayName = 'SidebarButton';

function renderIcon(icon: IconName | React.ReactNode, size?: IconSize) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={'lg'} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      label: 'toolbar-button',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      minHeight: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      width: '100%',
      overflow: 'hidden',
      lineHeight: `${theme.components.height.md * theme.spacing.gridSize - 2}px`,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      background: 'transparent',
      border: `none`,

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },

      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&[disabled], &:disabled': {
        cursor: 'not-allowed',
        opacity: theme.colors.action.disabledOpacity,
      },
    }),
    compact: css({
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      width: theme.spacing(5),
    }),
    iconWrapper: css({
      padding: 2,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      position: 'relative',
      borderRadius: theme.shape.radius.sm,
      svg: {
        [theme.transitions.handleMotion('no-preference', 'reduce')]: {
          ...getIconTransitionStyles(theme),
        },
      },
      '&:hover, &:focus-visible': {
        background: theme.colors.action.hover,
      },
      '&.primary': {
        backgroundColor: theme.colors.primary.main,
          color: theme.colors.getContrastText(theme.colors.primary.main),

        '&:hover': {
          backgroundColor: theme.colors.primary.shade,
        },
      },
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        ...getIconTransitionStyles(theme),
      },
    }),
    iconActive: css({
      ...getActiveButtonStyles(theme.colors.secondary, 'solid'),
      '&::before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: '100%',
        height: '2px',
        borderBottomLeftRadius: theme.shape.radius.sm,
        borderBottomRightRadius: theme.shape.radius.sm,
        backgroundImage: theme.colors.gradients.brandHorizontal,
      },
    }),
    buttonWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      whiteSpace: 'nowrap',
    }),
    title: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      textAlign: 'center',
      whiteSpace: 'nowrap',
    }),
    titleActive: css({
      color: theme.colors.text.primary,
    }),
    leftButton: css({
      '&::before': {
        right: 'unset',
        left: 0,
        top: 0,
        height: '100%',
      },
    }),
  };
};

function getIconTransitionStyles(theme: GrafanaTheme2) {
  return {
    transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
      duration: theme.transitions.duration.short,
    }),
  };
}
