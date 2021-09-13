import React, { FC, HTMLAttributes } from 'react';
import { css, cx } from '@emotion/css';
import { IconSize, useStyles, Icon } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLButtonElement> {
  isCollapsed: boolean;
  onToggle: (isCollapsed: boolean) => void;
  size?: IconSize;
  className?: string;
  text?: string;
}

export const CollapseToggle: FC<Props> = ({ isCollapsed, onToggle, className, text, size = 'xl', ...restOfProps }) => {
  const styles = useStyles(getStyles);

  return (
    <button className={cx(styles.expandButton, className)} onClick={() => onToggle(!isCollapsed)} {...restOfProps}>
      <Icon size={size} name={isCollapsed ? 'angle-right' : 'angle-down'} />
      {text}
    </button>
  );
};

export const getStyles = () => ({
  expandButton: css`
    background: none;
    border: none;

    outline: none !important;

    display: inline-flex;
    align-items: center;

    svg {
      margin-bottom: 0;
    }
  `,
});
