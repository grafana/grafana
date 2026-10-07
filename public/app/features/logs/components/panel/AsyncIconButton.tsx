import { useState, useEffect } from 'react';

import { type IconName } from '@grafana/data';
import { type IconSize, IconButton } from '@grafana/ui';

interface AsyncIconButtonProps extends Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  name: IconName;
  isActive?(): Promise<boolean>;
  size?: IconSize;
  tooltipSuffix: string;
}

export const AsyncIconButton = ({ isActive, tooltipSuffix, ...rest }: AsyncIconButtonProps) => {
  const [active, setActive] = useState(false);
  const tooltip = active ? 'Remove filter' : 'Filter for value';

  useEffect(() => {
    isActive?.().then(setActive);
  }, [isActive]);

  return <IconButton {...rest} variant={active ? 'primary' : undefined} tooltip={tooltip + tooltipSuffix} />;
};
