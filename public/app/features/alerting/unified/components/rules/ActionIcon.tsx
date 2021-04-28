import { Icon, IconName, useStyles, Tooltip } from '@grafana/ui';
import { PopoverContent } from '@grafana/ui/src/components/Tooltip/Tooltip';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip/PopoverController';
import React, { FC } from 'react';
import { css, cx } from '@emotion/css';

interface Props {
  tooltip: PopoverContent;
  icon: IconName;

  className?: string;
  tooltipPlacement?: TooltipPlacement;
  href?: string;
  target?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export const ActionIcon: FC<Props> = ({
  tooltip,
  icon,
  href,
  target,
  onClick,
  className,
  tooltipPlacement = 'top',
}) => {
  const iconEl = <Icon className={cx(useStyles(getStyle), className)} name={icon} />;

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {(() => {
        if (href || onClick) {
          return (
            <a href={href} onClick={onClick} target={target}>
              {iconEl}
            </a>
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
