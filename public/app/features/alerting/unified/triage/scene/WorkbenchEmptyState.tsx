import { css } from '@emotion/css';
import { Fragment } from 'react';

import { type GrafanaTheme2, makeTimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { sceneGraph } from '@grafana/scenes';
import { useSceneContext } from '@grafana/scenes-react';
import { Box, Button, Icon, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { trackTriageWorkbenchPredefinedTimeRangeApply } from '../../Analytics';

import { FiringCount, PendingCount } from './BadgeCounts';
import {
  type TriagePredefinedTimeRangeStat,
  useTriagePredefinedTimeRangeStats,
} from './useTriagePredefinedTimeRangeStats';

interface WorkbenchEmptyStateProps {
  hasActiveFilters: boolean;
}

export function WorkbenchEmptyState({ hasActiveFilters }: WorkbenchEmptyStateProps) {
  const styles = useStyles2(getStyles);
  const sceneContext = useSceneContext();
  const { windows, isLoading } = useTriagePredefinedTimeRangeStats();

  const applyTimeRange = (window: TriagePredefinedTimeRangeStat) => {
    const from = `now-${window.duration}`;
    trackTriageWorkbenchPredefinedTimeRangeApply({
      time_window_duration: window.duration,
      time_range_from: from,
      has_activity_in_window: window.firing + window.pending > 0,
      has_active_filters: hasActiveFilters,
    });

    const sceneTimeRange = sceneGraph.getTimeRange(sceneContext);
    sceneTimeRange.onTimeRangeChange(makeTimeRange(from, 'now'));
  };

  return (
    <Box display="flex" justifyContent="center" width="100%" paddingY={4}>
      <Stack direction="column" gap={3} alignItems="center">
        <Stack direction="column" gap={1} alignItems="center">
          <Text variant="h4">
            {hasActiveFilters
              ? t('alerting.triage.no-matching-instances-found', 'No matching instances found')
              : t('alerting.triage.no-firing-or-pending-instances', 'No firing or pending instances')}
          </Text>
          <Text color="secondary" textAlignment="center">
            {hasActiveFilters ? (
              <Trans i18nKey="alerting.triage.no-matching-instances-with-filters">
                No alert instances match your current set of filters for the selected time range.
              </Trans>
            ) : (
              <Trans i18nKey="alerting.triage.no-firing-or-pending-instances-description">
                No alert instances were in a firing or pending state for the selected time range.
              </Trans>
            )}
          </Text>
        </Stack>

        <div className={styles.card}>
          <Text variant="body" weight="medium">
            <Trans i18nKey="alerting.triage.predefined-time-ranges-heading">
              Alert activity in other time ranges:
            </Trans>
          </Text>

          {isLoading ? (
            <Box display="flex" justifyContent="center" paddingY={2}>
              <Spinner />
            </Box>
          ) : (
            <div className={styles.grid}>
              <span className={styles.gridHeader}>
                <Trans i18nKey="alerting.triage.time-range-column">Time range</Trans>
              </span>
              <span className={styles.gridHeader}>
                <Trans i18nKey="alerting.triage.firing-column">Firing</Trans>
              </span>
              <span className={styles.gridHeader}>
                <Trans i18nKey="alerting.triage.pending-column">Pending</Trans>
              </span>
              <span />

              {windows.map((window) => (
                <Fragment key={window.duration}>
                  <span className={styles.gridCell}>{window.label}</span>
                  <span className={styles.gridCell}>
                    {window.firing > 0 ? (
                      <FiringCount count={window.firing} />
                    ) : (
                      <Text color="secondary" variant="bodySmall">
                        {t('alerting.triage.predefined-time-range-count-zero', '0')}
                      </Text>
                    )}
                  </span>
                  <span className={styles.gridCell}>
                    {window.pending > 0 ? (
                      <PendingCount count={window.pending} />
                    ) : (
                      <Text color="secondary" variant="bodySmall">
                        {t('alerting.triage.predefined-time-range-count-zero', '0')}
                      </Text>
                    )}
                  </span>
                  <span className={styles.gridCell}>
                    {window.firing + window.pending > 0 ? (
                      <Button
                        size="sm"
                        variant="primary"
                        fill="text"
                        onClick={() => applyTimeRange(window)}
                        aria-label={t('alerting.triage.view-time-range', 'View {{label}}', {
                          label: window.label,
                        })}
                      >
                        <Trans i18nKey="alerting.triage.apply-time-range-button">Apply time range</Trans>
                        <Icon name="arrow-right" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        fill="text"
                        onClick={() => applyTimeRange(window)}
                        aria-label={t('alerting.triage.view-time-range', 'View {{label}}', {
                          label: window.label,
                        })}
                      >
                        <Trans i18nKey="alerting.triage.apply-time-range-button">Apply time range</Trans>
                      </Button>
                    )}
                  </span>
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </Stack>
    </Box>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    width: '100%',
    maxWidth: '520px',
  }),
  grid: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto auto auto',
    gap: theme.spacing(0, 2),
    alignItems: 'center',
  }),
  gridHeader: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.secondary,
    padding: theme.spacing(0.5, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  gridCell: css({
    ...theme.typography.body,
    padding: theme.spacing(1, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    display: 'flex',
    alignItems: 'center',
  }),
});
