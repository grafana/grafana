import { css, cx } from '@emotion/css';
import { useContext } from 'react';

import { GrafanaTheme2, IconName, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { getFocusStyles, getMouseFocusStyles } from '../../themes/mixins';
import { getActiveButtonStyles } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';

import { SidebarContext } from './useSidebar';

export interface Props {
  icon: IconName;
  active?: boolean;
  onClick?: () => void;
  title: string;
  tooltip?: string;
  compact?: boolean;
}

export function SidebarButton({ icon, active, onClick, title, tooltip, compact = true }: Props) {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('Sidebar.Button must be used within a Sidebar component');
  }

  const buttonClass = cx(
    styles.button,
    compact && styles.compact,
    active && styles.active,
    context.position === 'left' && styles.leftButton
  );

  return (
    <div className={styles.buttonWrapper}>
      <Tooltip content={tooltip ?? title} placement={context.position === 'left' ? 'right' : 'left'}>
        <button className={buttonClass} aria-label={title} aria-expanded={active} type="button" onClick={onClick}>
          {renderIcon(icon, compact)}
        </button>
      </Tooltip>
      {!compact && <span className={cx(styles.title, active && styles.titleActive)}>{title}</span>}
    </div>
  );
}

function renderIcon(icon: IconName | React.ReactNode, compact: boolean) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={compact ? `lg` : `lg`} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    button: css({
      label: 'toolbar-button',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      // borderRadius: theme.shape.radius.sm,
      lineHeight: `${theme.components.height.md * theme.spacing.gridSize - 2}px`,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      color: theme.colors.text.secondary,
      background: 'transparent',
      border: `none`,
      width: '100%',
      justifyContent: 'center',

      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'border-color', 'color'], {
          duration: theme.transitions.duration.short,
        }),
      },

      [theme.breakpoints.down('md')]: {
        width: 'auto !important',
      },

      '&:focus, &:focus-visible': {
        ...getFocusStyles(theme),
        zIndex: 1,
      },

      '&:focus:not(:focus-visible)': getMouseFocusStyles(theme),

      '&[disabled], &:disabled': {
        cursor: 'not-allowed',
        opacity: theme.colors.action.disabledOpacity,
        background: theme.colors.action.disabledBackground,
        boxShadow: 'none',

        '&:hover': {
          color: theme.colors.text.disabled,
          background: theme.colors.action.disabledBackground,
          boxShadow: 'none',
        },
      },

      '&:hover, &:focus-visible': {
        color: theme.colors.text.primary,
        background: theme.colors.action.hover,
      },

      '&:active': {
        ...getActiveButtonStyles(theme.colors.secondary, 'solid'),
      },
    }),
    compact: css({
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
    }),
    active: css({
      color: theme.colors.text.primary,
      background: theme.colors.action.selected,
      '&::before': {
        display: 'block',
        content: '" "',
        position: 'absolute',
        right: 0,
        top: 0,
        height: '100%',
        width: '2px',
        borderRadius: theme.shape.radius.default,
        backgroundImage: theme.colors.gradients.brandVertical,
      },
    }),
    buttonWrapper: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      gap: theme.spacing(0),
    }),
    title: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
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
