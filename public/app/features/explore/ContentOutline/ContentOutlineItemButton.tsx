import { cx, css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { IconName, isIconName, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Tooltip, IconSize } from '@grafana/ui';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip';

type CommonProps = {
  title?: string;
  icon?: IconName | React.ReactNode;
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
  className?: string;
  indentStyle?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  toggleCollapsed?: () => void;
  isActive?: boolean;
};

export type ContentOutlineItemButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function ContentOutlineItemButton({
  title,
  icon,
  tooltip,
  tooltipPlacement = 'bottom',
  className,
  indentStyle,
  collapsible,
  collapsed,
  toggleCollapsed,
  isActive,
  ...rest
}: ContentOutlineItemButtonProps) {
  const styles = useStyles2(getStyles);

  const buttonStyles = cx(styles.button, className);

  const body = (
    <div className={cx(styles.buttonContainer, indentStyle)}>
      {collapsible && (
        <button
          className={styles.collapseButton}
          onClick={toggleCollapsed}
          aria-label="content-outline-item-chevron-collapse"
        >
          {renderIcon(collapsed ? 'angle-right' : 'angle-down')}
        </button>
      )}
      <button
        className={cx(buttonStyles, {
          [styles.active]: isActive,
        })}
        aria-label={tooltip}
        {...rest}
      >
        {renderIcon(icon)}
        {title && <span className={styles.textContainer}>{title}</span>}
      </button>
    </div>
  );

  return tooltip ? (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {body}
    </Tooltip>
  ) : (
    body
  );
}

function renderIcon(icon: IconName | React.ReactNode, size: IconSize = 'lg', rotateIcon?: number) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={size} rotate={rotateIcon} title={icon} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonContainer: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flexGrow: 1,
      gap: theme.spacing(1),
      overflow: 'hidden',
      width: '100%',
    }),
    button: css({
      label: 'content-outline-item-button',
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
      width: '100%',
      background: 'transparent',
      border: 'none',
    }),
    collapseButton: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: theme.spacing(3),
      height: theme.spacing(4),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      background: 'transparent',
      border: 'none',

      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.secondary.shade,
      },
    }),
    textContainer: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    active: css({
      backgroundColor: theme.colors.background.secondary,
      borderTopRightRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      position: 'relative',

      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: '2px',
      },
    }),
  };
};
