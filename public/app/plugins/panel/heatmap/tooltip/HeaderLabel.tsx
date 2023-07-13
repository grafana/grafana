import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import { LabelValue } from './tooltipUtils';

interface HeaderLabelProps {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: HeaderLabelProps) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg">
      <div>
        <span className={styles.label}>{headerLabel.label}</span>
        <span className={styles.value}>{headerLabel.value}</span>
      </div>
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    padding-right: ${theme.spacing(0.5)};
  `,
  value: css`
    font-weight: 500;
    line-height: 18px;
  `,
});
