import React, { FC } from 'react';

import { PanelProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { getStyles } from './PTSummary.styles';

export const PTSummaryPanel: FC<PanelProps> = ({ data }) => {
  const styles = useStyles2(getStyles);
  const series = data.series[0];
  const summary = series?.fields.find((f) => f.name === 'summary');
  const fingerprint = (summary?.values || [])[0];

  return (
    <div className={styles.ptSummaryWrapper}>
      <pre data-testid="pt-summary-fingerprint" className={styles.ptSummary}>
        {fingerprint}
      </pre>
    </div>
  );
};
