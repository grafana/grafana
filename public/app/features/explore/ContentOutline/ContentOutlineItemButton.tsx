import { cx, css } from '@emotion/css';
import React, { ButtonHTMLAttributes } from 'react';

import { IconName, isIconName, GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2, Tooltip, IconSize } from '@grafana/ui';

type CommonProps = {
  title?: string;
  icon?: string;
  tooltip?: string;
  className?: string;
  topLeftIcon?: string;
  onTopLeftIconClick?: () => void;
};

export type ContentOutlineItemButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

export function ContentOutlineItemButton({
  title,
  icon,
  tooltip,
  className,
  topLeftIcon,
  onTopLeftIconClick,
  ...rest
}: ContentOutlineItemButtonProps) {
  const styles = useStyles2(getStyles);

  const buttonStyles = cx(styles.button, className);

  const body = (
    <div className={styles.buttonContainer}>
      {topLeftIcon && (
        <button className={styles.topLeftIcon} onClick={onTopLeftIconClick}>
          {renderIcon(topLeftIcon, 'lg')}
        </button>
      )}
      <button className={buttonStyles} aria-label={tooltip} {...rest}>
        {renderIcon(icon)}
        {title && <span className={styles.textContainer}>{title}</span>}
      </button>
    </div>
  );

  return tooltip ? (
    <Tooltip content={tooltip} placement="bottom">
      {body}
    </Tooltip>
  ) : (
    body
  );
}

function renderIcon(icon: IconName | React.ReactNode, size: IconSize = 'lg') {
  if (!icon) {
    return null;
  }

  if (isIconName(icon)) {
    return <Icon name={icon} size={size} />;
  }

  return icon;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    buttonContainer: css({
      position: 'relative',
    }),
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
      maxWidth: '155px',
    }),
    textContainer: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    topLeftIcon: css({
      position: 'absolute',
      top: '1px',
      left: 0,
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      padding: 0,
      margin: 0,
    }),
  };
};
