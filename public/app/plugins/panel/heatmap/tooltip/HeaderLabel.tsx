import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, Tooltip, useStyles2 } from '@grafana/ui';

import { LabelValue } from './tooltipUtils';

interface HeaderLabelProps {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: HeaderLabelProps) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg" wrap maxLength={240}>
      <div className={styles.wrapper}>
        <span className={styles.label}>{headerLabel.label}</span>
        <Tooltip content={headerLabel.value}>
          <span className={styles.value}>{headerLabel.value}</span>
        </Tooltip>
      </div>
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    padding-right: ${theme.spacing(0.5)};
    font-weight: 400;
  `,
  value: css`
    line-height: 18px;
    align-self: center;
    max-width: 210px;
    font-weight: 500;
  `,
  wrapper: css`
    display: flex;
    flex-direction: row;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 1) 80%, transparent);
  `,
});
