import { HTMLAttributes } from 'react';

import { Button, IconSize } from '@grafana/ui';

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
