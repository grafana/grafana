import { Icon, IconName, useStyles, Tooltip } from '@grafana/ui';
import { PopoverContent } from '@grafana/ui/src/components/Tooltip/Tooltip';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip/PopoverController';
import React, { FC } from 'react';
import { css, cx } from '@emotion/css';
import { Link } from 'react-router-dom';

interface Props {
  tooltip: PopoverContent;
  icon: IconName;

  className?: string;
  tooltipPlacement?: TooltipPlacement;
  to?: string;
  target?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  'data-testid'?: string;
}

export const ActionIcon: FC<Props> = ({
  tooltip,
  icon,
  to,
  target,
  onClick,
  className,
  tooltipPlacement = 'top',
  ...rest
}) => {
  const ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;
  const iconEl = (
    <Icon
      role="button"
      className={cx(useStyles(getStyle), className)}
      onClick={onClick}
      name={icon}
      {...rest}
      aria-label={ariaLabel}
    />
  );

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {to ? (
        <GoTo url={to} label={ariaLabel} target={target}>
          {iconEl}
        </GoTo>
      ) : (
        iconEl
      )}
    </Tooltip>
  );
};

interface GoToProps {
  url: string;
  label?: string;
  target?: string;
  children?: React.ReactNode;
}

const GoTo = React.forwardRef<HTMLAnchorElement, GoToProps>(({ url, label, target, children }, ref) => {
  const absoluteUrl = url?.startsWith('http');

  return absoluteUrl ? (
    <a ref={ref} aria-label={label} href={url} target={target}>
      {children}
    </a>
  ) : (
    <Link ref={ref} aria-label={label} to={url} target={target}>
      {children}
    </Link>
  );
});

GoTo.displayName = 'GoTo';

export const getStyle = () => css`
  cursor: pointer;
`;
