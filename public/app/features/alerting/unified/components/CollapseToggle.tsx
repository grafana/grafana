import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { IconSize, useStyles, Icon } from '@grafana/ui';

interface Props {
  isCollapsed: boolean;
  onToggle: (isCollapsed: boolean) => void;
  size?: IconSize;
  className?: string;
}

export const CollapseToggle: FC<Props> = ({ isCollapsed, onToggle, className, size = 'xl' }) => {
  const styles = useStyles(getStyles);

  return (
    <button className={cx(styles.expandButton, className)} onClick={() => onToggle(!isCollapsed)}>
      <Icon size={size} name={isCollapsed ? 'angle-right' : 'angle-down'} />
    </button>
  );
};

export const getStyles = () => ({
  expandButton: css`
    background: none;
    border: none;

    svg {
      margin-bottom: 0;
    }
  `,
});
