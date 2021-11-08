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
  const iconEl = (
    <Icon role="button" className={cx(useStyles(getStyle), className)} onClick={onClick} name={icon} {...rest} />
  );

  const ariaLabel = typeof tooltip === 'string' ? tooltip : undefined;
  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {(() => {
        if (to) {
          return (
            <Link aria-label={ariaLabel} to={to} target={target}>
              {iconEl}
            </Link>
          );
        }
        return iconEl;
      })()}
    </Tooltip>
  );
};

export const getStyle = () => css`
  cursor: pointer;
`;
