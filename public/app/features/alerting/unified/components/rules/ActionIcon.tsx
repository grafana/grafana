import { Icon, IconName, useStyles } from '@grafana/ui';
import { Tooltip, TooltipProps } from '@grafana/ui/src/components/Tooltip/Tooltip';
import React, { FC } from 'react';
import { css } from 'emotion';

interface Props {
  tooltip: TooltipProps['content'];
  icon: IconName;

  tooltipPlacement?: TooltipProps['placement'];
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
