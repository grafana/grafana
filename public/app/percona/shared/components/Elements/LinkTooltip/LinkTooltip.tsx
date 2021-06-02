import React, { FC } from 'react';
import { Icon, IconName, Tooltip, useTheme } from '@grafana/ui';
import { getStyles } from './LinkTooltip.styles';

export interface LinkTooltipProps {
  tooltipText: string;
  link?: string;
  linkText?: string;
  icon: IconName;
  dataQa?: string;
  target?: string;
  className?: string;
}

export const LinkTooltip: FC<LinkTooltipProps> = ({ tooltipText, link, linkText, icon, dataQa, target = '_blank' }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Tooltip
      content={
        <div className={styles.contentWrapper}>
          <span>{tooltipText}</span>
          {link && linkText && (
            <a className={styles.link} href={link} target={target}>
              {linkText}
            </a>
          )}
        </div>
      }
      data-qa={dataQa}
    >
      <div>
        <Icon name={icon} />
      </div>
    </Tooltip>
  );
};
