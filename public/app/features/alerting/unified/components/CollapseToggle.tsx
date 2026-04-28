import { type HTMLAttributes } from 'react';

import { Button } from '@grafana/ui';
import type { IconSize } from '@grafana/ui/types';

interface Props extends Omit<HTMLAttributes<HTMLButtonElement>, 'onToggle'> {
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
  return (
    <Button
      type="button"
      fill="text"
      variant="secondary"
      aria-expanded={!isCollapsed}
      aria-controls={idControlled}
      className={className}
      icon={isCollapsed ? 'angle-right' : 'angle-down'}
      onClick={() => onToggle(!isCollapsed)}
      {...restOfProps}
    >
      {text}
    </Button>
  );
};
