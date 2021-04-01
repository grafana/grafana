import { Icon, IconName, useStyles, Tooltip } from '@grafana/ui';
import { PopoverContent } from '@grafana/ui/src/components/Tooltip/Tooltip';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip/PopoverController';
import React, { FC } from 'react';
import { css } from '@emotion/css';

interface Props {
  tooltip: PopoverContent;
  icon: IconName;

  tooltipPlacement?: TooltipPlacement;
  href?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
}

export const ActionIcon: FC<Props> = ({ tooltip, icon, href, onClick, tooltipPlacement = 'top' }) => {
  const iconEl = <Icon className={useStyles(getStyle)} name={icon} />;

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {(() => {
        if (href || onClick) {
          return (
            <a href={href} onClick={onClick}>
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
