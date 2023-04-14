import { css, cx } from '@emotion/css';
import React, { HTMLAttributes } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { IconSize, useStyles2, Button } from '@grafana/ui';

interface Props extends HTMLAttributes<HTMLButtonElement> {
  isCollapsed: boolean;
  onToggle: (isCollapsed: boolean) => void;
  // Todo: this should be made compulsory for a11y purposes
  idControlled?: string;
  size?: IconSize;
  className?: string;
  text?: string;
}

export const CollapseToggle = ({
  isCollapsed,
  onToggle,
  idControlled,
  className,
  text,
  size = 'xl',
  ...restOfProps
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Button
      type="button"
      fill="text"
      variant="secondary"
      aria-expanded={!isCollapsed}
      aria-controls={idControlled}
      className={cx(styles.expandButton, className)}
      icon={isCollapsed ? 'angle-right' : 'angle-down'}
      onClick={() => onToggle(!isCollapsed)}
      {...restOfProps}
    >
      {text}
    </Button>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  expandButton: css`
    margin-right: ${theme.spacing(1)};
  `,
});
