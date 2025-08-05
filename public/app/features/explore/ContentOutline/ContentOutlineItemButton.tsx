import { cx, css } from '@emotion/css';
import { ButtonHTMLAttributes, useEffect, useRef, useState } from 'react';
import * as React from 'react';

import { IconName, isIconName, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Icon, Tooltip, useTheme2 } from '@grafana/ui';
import { TooltipPlacement } from '@grafana/ui/internal';

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
  extraHighlight?: boolean;
  sectionId?: string;
  toggleCollapsed?: () => void;
  color?: string;
  onRemove?: () => void;
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
  extraHighlight,
  sectionId,
  toggleCollapsed,
  color,
  onRemove,
  ...rest
}: ContentOutlineItemButtonProps) {
  const theme = useTheme2();
  const styles = getStyles(theme, color);

  const buttonStyles = cx(styles.button, className);

  const textRef = useRef<HTMLElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      setIsOverflowing(textRef.current?.scrollWidth > textRef.current?.clientWidth);
    }
  }, [title]);

  const body = (
    <div className={cx(styles.buttonContainer, indentStyle)}>
      {collapsible && (
        <button
          className={styles.collapseButton}
          onClick={toggleCollapsed}
          aria-label={t(
            'explore.content-outline-item-button.body.aria-label-content-outline-item-collapse-button',
            'Content outline item collapse button'
          )}
          aria-expanded={!collapsed}
          aria-controls={sectionId}
        >
          <OutlineIcon icon={collapsed ? 'angle-right' : 'angle-down'} />
        </button>
      )}
      <button
        className={cx(buttonStyles, {
          [styles.active]: isActive,
          [styles.extraHighlight]: extraHighlight,
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
      {onRemove && (
        <Button
          aria-label={t(
            'explore.content-outline-item-button.body.aria-label-content-outline-item-delete-button',
            'Delete item'
          )}
          variant="destructive"
          className={styles.deleteButton}
          icon="times"
          onClick={() => onRemove()}
          data-testid="content-outline-item-delete-button"
        />
      )}
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

const getStyles = (theme: GrafanaTheme2, color?: string) => {
  return {
    buttonContainer: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flexGrow: 1,
      gap: theme.spacing(0.25),
      width: '100%',
      overflow: 'hidden',
    }),
    button: css({
      label: 'content-outline-item-button',
      display: 'flex',
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      width: '100%',
      background: 'transparent',
      overflow: 'hidden',
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
      overflow: 'hidden',

      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.secondary.shade,
      },
    }),
    textContainer: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontSize: theme.typography.bodySmall.fontSize,
      marginLeft: theme.spacing(0.5),
    }),
    active: css({
      backgroundColor: theme.colors.background.secondary,
      borderTopRightRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      position: 'relative',
      height: theme.spacing(theme.components.height.md),

      '&::before': {
        backgroundImage: color !== undefined ? 'none' : theme.colors.gradients.brandVertical,
        backgroundColor: color !== undefined ? color : 'none',
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
    extraHighlight: css({
      backgroundColor: theme.colors.background.secondary,
      borderTopRightRadius: theme.shape.radius.default,
      borderBottomRightRadius: theme.shape.radius.default,
      position: 'relative',

      '&::before': {
        backgroundImage: color !== undefined ? 'none' : theme.colors.gradients.brandVertical,
        backgroundColor: color !== undefined ? color : 'none',
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
    deleteButton: css({
      width: theme.spacing(1),
      height: theme.spacing(1),
      padding: theme.spacing(0.75, 0.75),
      marginRight: theme.spacing(0.5),
    }),
  };
};
