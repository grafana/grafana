import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Spinner, TimeRangeLabel, useStyles2 } from '@grafana/ui';

export interface Props {
  timeRange: TimeRange;
  className?: string;
  isDataLoading?: boolean;
  timeSelectionEnabled?: boolean;
  annotationsEnabled?: boolean;
}

export function SettingsSummary({
  className,
  isDataLoading = false,
  timeRange,
  timeSelectionEnabled,
  annotationsEnabled,
}: Props) {
  const styles = useStyles2(getStyles);

  return isDataLoading ? (
    <div className={cx(styles.summaryWrapper, className)}>
      <Spinner className={styles.summary} inline={true} size={14} />
    </div>
  ) : (
    <div className={cx(styles.summaryWrapper, className)}>
      <div className={styles.summary}>
        {'Time range = '}
        <TimeRangeLabel className={styles.timeRange} value={timeRange} />
      </div>
      <div className={styles.summary}>{`Time range picker = ${timeSelectionEnabled}`}</div>
      <div className={styles.summary}>{`Annotations = ${annotationsEnabled}`}</div>
    </div>
  );
}

SettingsSummary.displayName = 'SettingsSummary';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    summaryWrapper: css({
      display: 'flex',
    }),
    summary: css`
      label: collapsed text;
      margin-left: ${theme.spacing.gridSize * 2}px;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,
    timeRange: css({
      display: 'inline-block',
    }),
  };
};
