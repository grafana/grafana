import React, { FC } from 'react';

import { Icon, IconName, Tooltip, useTheme } from '@grafana/ui';

import { getStyles } from './LinkTooltip.styles';

export interface LinkTooltipProps {
  tooltipContent?: React.ReactNode;
  link?: string;
  linkText?: string;
  icon: IconName;
  dataTestId?: string;
  target?: string;
  className?: string;
}

export const LinkTooltip: FC<React.PropsWithChildren<LinkTooltipProps>> = ({
  tooltipContent,
  link,
  linkText,
  icon,
  dataTestId,
  target = '_blank',
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Tooltip
      interactive
      content={
        <div className={styles.contentWrapper} data-testid={dataTestId || 'info-tooltip'}>
          {typeof tooltipContent === 'string' ? <span>{tooltipContent}</span> : tooltipContent}
          {link && linkText && (
            <a className={styles.link} href={link} target={target}>
              {linkText}
            </a>
          )}
        </div>
      }
    >
      <div>
        <Icon name={icon} />
      </div>
    </Tooltip>
  );
};
