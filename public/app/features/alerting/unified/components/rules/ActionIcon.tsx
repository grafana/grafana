import { Icon, IconName, useStyles, Tooltip } from '@grafana/ui';
import { PopoverContent } from '@grafana/ui/src/components/Tooltip/Tooltip';
import { TooltipPlacement } from '@grafana/ui/src/components/Tooltip/PopoverController';
import React, { FC } from 'react';
import { css } from 'emotion';

interface Props {
  tooltip: PopoverContent;
  icon: IconName;

  tooltipPlacement?: TooltipPlacement;
  href?: string;
}

export const ActionIcon: FC<Props> = ({ tooltip, icon, href, tooltipPlacement = 'top' }) => {
  const iconEl = <Icon className={useStyles(getStyle)} name={icon} />;

  return (
    <Tooltip content={tooltip} placement={tooltipPlacement}>
      {(() => {
        if (href) {
          return <a href={href}>{iconEl}</a>;
        }
        return iconEl;
      })()}
    </Tooltip>
  );
};

export const getStyle = () => css`
  cursor: pointer;
`;
