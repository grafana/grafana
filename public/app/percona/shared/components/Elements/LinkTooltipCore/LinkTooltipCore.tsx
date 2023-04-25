import React, { FC } from 'react';

import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { LabelTooltipProps } from '../../../helpers/types';

import { getStyles } from './LinkTooltipCore.styles';

export const LinkTooltipCore: FC<LabelTooltipProps> = ({
  tooltipText,
  tooltipLink,
  tooltipLinkText = 'Read more',
  tooltipIcon = 'info-circle',
  tooltipDataTestId,
  tooltipLinkTarget = '_blank',
  tooltipInteractive,
}) => {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip
      content={
        <div className={styles.contentWrapper}>
          <span>{tooltipText}</span>
          {tooltipLink && (
            <a className={styles.link} href={tooltipLink} target={tooltipLinkTarget}>
              {tooltipLinkText}
            </a>
          )}
        </div>
      }
      data-testid={tooltipDataTestId}
      interactive={!!tooltipLink ? true : !!tooltipInteractive}
    >
      <div>
        <Icon name={tooltipIcon} />
      </div>
    </Tooltip>
  );
};
