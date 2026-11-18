import { cx } from '@emotion/css';
import { useState, useEffect } from 'react';

import { type IconName } from '@grafana/data';
import { type IconSize, IconButton, useStyles2 } from '@grafana/ui';

import { getIconButtonStyles } from './activeIconButtonStyles';

interface AsyncIconButtonProps extends Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  name: IconName;
  isActive?(): Promise<boolean>;
  size?: IconSize;
  tooltipSuffix: string;
}

export const AsyncIconButton = ({ isActive, tooltipSuffix, ...rest }: AsyncIconButtonProps) => {
  const [active, setActive] = useState(false);
  const styles = useStyles2(getIconButtonStyles);
  const tooltip = active ? 'Remove filter' : 'Filter for value';

  useEffect(() => {
    isActive?.().then(setActive);
  }, [isActive]);

  return (
    <IconButton
      {...rest}
      className={cx(styles.iconButton, active && styles.activeIconButton)}
      tooltip={tooltip + tooltipSuffix}
    />
  );
};
