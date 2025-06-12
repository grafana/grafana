import { css, cx } from '@emotion/css';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
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

  const translatedTimeRangePickerEnabledStatus = t(
    'public-dashboard.settings-summary.time-range-picker-enabled-text',
    'Time range picker = enabled'
  );
  const translatedTimeRangePickerDisabledStatus = t(
    'public-dashboard.settings-summary.time-range-picker-disabled-text',
    'Time range picker = disabled'
  );
  const translatedAnnotationShownStatus = t(
    'public-dashboard.settings-summary.annotations-show-text',
    'Annotations = show'
  );
  const translatedAnnotationHiddenStatus = t(
    'public-dashboard.settings-summary.annotations-hide-text',
    'Annotations = hide'
  );

  return isDataLoading ? (
    <div className={cx(styles.summaryWrapper, className)}>
      <Spinner className={styles.summary} inline={true} size="sm" />
    </div>
  ) : (
    <div className={cx(styles.summaryWrapper, className)}>
      <span className={styles.summary}>
        <Trans i18nKey="public-dashboard.settings-summary.time-range-text">Time range = </Trans>
        <TimeRangeLabel className={styles.timeRange} value={timeRange} />
      </span>
      <span className={styles.summary}>
        {timeSelectionEnabled ? translatedTimeRangePickerEnabledStatus : translatedTimeRangePickerDisabledStatus}
      </span>
      <span className={styles.summary}>
        {annotationsEnabled ? translatedAnnotationShownStatus : translatedAnnotationHiddenStatus}
      </span>
    </div>
  );
}

SettingsSummary.displayName = 'SettingsSummary';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    summaryWrapper: css({
      display: 'flex',
    }),
    summary: css({
      label: 'collapsedText',
      marginLeft: `${theme.spacing.gridSize * 2}px`,
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
    }),
    timeRange: css({
      display: 'inline-block',
    }),
  };
};
