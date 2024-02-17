import { cx, css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { IconName, isIconName, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Tooltip } from '@grafana/ui';

type CommonProps = {
  title?: string;
  icon: string;
  tooltip?: string;
  className?: string;
  isActive?: boolean;
};

export type ContentOutlineItemButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function ContentOutlineItemButton({
  title,
  icon,
  tooltip,
  className,
  isActive,
  ...rest
}: ContentOutlineItemButtonProps) {
  const styles = useStyles2(getStyles);

  const buttonStyles = cx(styles.button, className);

  const body = (
    <button
      className={cx(buttonStyles, {
        [styles.active]: isActive,
      })}
      aria-label={tooltip}
      {...rest}
    >
      {renderIcon(icon)}
      {title}
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

function renderIcon(icon: IconName | React.ReactNode) {
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
      label: 'content-outline-item-button',
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      height: theme.spacing(theme.components.height.md),
      padding: theme.spacing(0, 1),
      gap: theme.spacing(1),
      color: theme.colors.text.secondary,
      background: 'transparent',
      border: 'none',
      textOverflow: 'ellipsis',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      '&:hover': {
        color: theme.colors.text.primary,
        background: theme.colors.background.secondary,
        textDecoration: 'underline',
      },
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
