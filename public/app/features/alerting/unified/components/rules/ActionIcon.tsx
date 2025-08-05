import { ComponentProps } from 'react';

import { Button, IconName, LinkButton, Tooltip } from '@grafana/ui';

type TooltipProps = ComponentProps<typeof Tooltip>;

interface Props {
  tooltip: TooltipProps['content'];
  icon: IconName;
  className?: string;
  tooltipPlacement?: TooltipProps['placement'];
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

  return to ? (
    <LinkButton
      tooltip={tooltip}
      tooltipPlacement={tooltipPlacement}
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
      tooltip={tooltip}
      tooltipPlacement={tooltipPlacement}
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
  );
};
