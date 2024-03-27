import { cx, css } from '@emotion/css';
import React, { ButtonHTMLAttributes, useEffect, useRef, useState } from 'react';

import { IconName, isIconName, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Tooltip } from '@grafana/ui';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip';

type CommonProps = {
  contentOutlineExpanded?: boolean;
  title?: string;
  icon?: IconName | React.ReactNode;
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
  className?: string;
  indentStyle?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  isActive?: boolean;
  sectionId?: string;
  toggleCollapsed?: () => void;
};

export type ContentOutlineItemButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function ContentOutlineItemButton({
  contentOutlineExpanded,
  title,
  icon,
  tooltip,
  tooltipPlacement = 'bottom',
  className,
  indentStyle,
  collapsible,
  collapsed,
  isActive,
  sectionId,
  toggleCollapsed,
  ...rest
}: ContentOutlineItemButtonProps) {
  const styles = useStyles2(getStyles);

  const buttonStyles = cx(styles.button, className);

  const textRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current?.scrollWidth > textRef.current?.clientWidth);
    }
  }, []);

  const body = (
    <div className={cx(styles.buttonContainer, indentStyle)}>
      {collapsible && (
        <button
          className={styles.collapseButton}
          onClick={toggleCollapsed}
          aria-label="Content outline item collapse button"
          aria-expanded={!collapsed}
          aria-controls={sectionId}
        >
          <OutlineIcon icon={collapsed ? 'angle-right' : 'angle-down'} />
        </button>
      )}
      <button
        className={cx(buttonStyles, {
          [styles.active]: isActive,
        })}
        aria-label={tooltip}
        {...rest}
      >
        <OutlineIcon icon={icon} />
        {title && (
          <span className={styles.textContainer} ref={textRef}>
            {title}
          </span>
        )}
      </button>
    </div>
  );

  // if there's a tooltip we want to show it if the text is overflowing
  const showTooltip = tooltip && (!contentOutlineExpanded || isOverflowing);

  return showTooltip ? (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {body}
    </Tooltip>
  ) : (
    body
  );
}

function OutlineIcon({ icon }: { icon: IconName | React.ReactNode }) {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={'lg'} title={icon} />;
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
