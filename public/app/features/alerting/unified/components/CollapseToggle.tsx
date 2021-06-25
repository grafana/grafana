import React, { FC, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { IconSize, useStyles, Icon } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLButtonElement> {
  isCollapsed: boolean;
  onToggle: (isCollapsed: boolean) => void;
  size?: IconSize;
  className?: string;
}

export const CollapseToggle: FC<Props> = ({ isCollapsed, onToggle, className, size = 'xl', ...restOfProps }) => {
  const styles = useStyles(getStyles);

  return (
    <button className={cx(styles.expandButton, className)} onClick={() => onToggle(!isCollapsed)} {...restOfProps}>
      <Icon size={size} name={isCollapsed ? 'angle-right' : 'angle-down'} />
    </button>
  );
};

export const getStyles = () => ({
  expandButton: css`
    background: none;
    border: none;

    outline: none !important;

    svg {
      margin-bottom: 0;
    }
  `,
});
