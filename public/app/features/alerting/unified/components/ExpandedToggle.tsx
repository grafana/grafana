import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { IconSize, useStyles, Icon } from '@grafana/ui';

interface Props {
  isExpanded: boolean;
  onToggle: (isExpanded: boolean) => void;
  size?: IconSize;
  className?: string;
}

export const ExpandedToggle: FC<Props> = ({ isExpanded, onToggle, className, size = 'xl' }) => {
  const styles = useStyles(getStyles);

  return (
    <button className={cx(styles.expandButton, className)} onClick={() => onToggle(!isExpanded)}>
      <Icon size={size} name={isExpanded ? 'angle-down' : 'angle-right'} />
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
