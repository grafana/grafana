import React from 'react';

import { IconName, Tooltip, LinkButton, Button } from '@grafana/ui';
import { PopoverContent, TooltipPlacement } from '@grafana/ui/src/components/Tooltip';

interface Props {
  tooltip: PopoverContent;
  icon: IconName;
  className?: string;
  tooltipPlacement?: TooltipPlacement;
  to?: string;
  target?: string;
  onClick?: () => void;
  'data-testid'?: string;
}

export const ActionIcon = ({
  tooltip,
  icon,
  to,
  target,
  onClick,
  className,
  tooltipPlacement = 'top',
  ...rest
}: Props) => {
  const ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {to ? (
        <LinkButton
          variant="secondary"
          fill="text"
          icon={icon}
          href={to}
          size="sm"
          target={target}
          {...rest}
          aria-label={ariaLabel}
        />
      ) : (
        <Button
          className={className}
          variant="secondary"
          fill="text"
          size="sm"
          icon={icon}
          type="button"
          onClick={onClick}
          {...rest}
          aria-label={ariaLabel}
        />
      )}
    </Tooltip>
  );
};
