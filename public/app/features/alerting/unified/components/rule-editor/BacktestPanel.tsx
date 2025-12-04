import { css } from '@emotion/css';
import { fromPairs, isEmpty } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { AlertLabels } from '@grafana/alerting/unstable';
import { DataFrameJSON, GrafanaTheme2, TimeRange, dateTime } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Collapse,
  Icon,
  LoadingPlaceholder,
  RefreshPicker,
  Stack,
  Text,
  TimeRangePicker,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { RuleFormValues } from '../../types/rule-form';
import { combineMatcherStrings } from '../../utils/alertmanager';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';
import { LogRecordViewerByTimestamp } from '../rules/state-history/LogRecordViewer';
import { LogTimelineViewer } from '../rules/state-history/LogTimelineViewer';
import { useFrameSubset } from '../rules/state-history/LokiStateHistory';
import { useRuleHistoryRecords } from '../rules/state-history/useRuleHistoryRecords';

interface BacktestPanelProps {
  isOpen: boolean;
  onToggle: (isOpen: boolean) => void;
  ruleDefinition: RuleFormValues;
  initialTimeRange?: TimeRange;
  triggerRun?: number;
}

export function BacktestPanel({ isOpen, onToggle, ruleDefinition, initialTimeRange, triggerRun }: BacktestPanelProps) {
  const styles = useStyles2(getStyles);
  const [timeRange, setTimeRange] = useState<TimeRange>(
    initialTimeRange || {
      from: dateTime().subtract(1, 'hour'),
      to: dateTime(),
      raw: { from: 'now-1h' as const, to: 'now' as const },
    }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [stateHistory, setStateHistory] = useState<DataFrameJSON | undefined>(undefined);
  const [instancesFilter, setInstancesFilter] = useState('');
  const logsRef = useRef<Map<number, HTMLElement>>(new Map<number, HTMLElement>());

  const { getValues, setValue } = useForm({ defaultValues: { query: '' } });

  const handleRunBacktest = async () => {
    setIsLoading(true);
    setError(null);
    setStateHistory(undefined);

    try {
      console.log(ruleDefinition);
      // Convert form values to the proper AlertRule format
      const alertRule = formValuesToRulerGrafanaRuleDTO(ruleDefinition);
      console.log(alertRule);

      // Flatten the alertRule structure: spread grafana_alert fields and top-level fields
      const requestBody = {
        from: timeRange.from.toISOString(),
        to: timeRange.to.toISOString(),
        // Spread all fields from grafana_alert
        ...alertRule.grafana_alert,
        // Spread all top-level fields (labels, annotations, for, keep_firing_for, etc.)
        labels: alertRule.labels,
        annotations: alertRule.annotations,
        for: alertRule.for,
        keep_firing_for: alertRule.keep_firing_for,
        interval: ruleDefinition.evaluateEvery,
      };

      const response = await fetch('/api/v1/rule/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: DataFrameJSON = await response.json();
      console.log('Backtesting API response:', data);

      setStateHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error occurred'));
    } finally {
      setIsLoading(false);
    }
  };

  // Update time range when initialTimeRange changes
  useEffect(() => {
    if (initialTimeRange) {
      setTimeRange(initialTimeRange);
    }
  }, [initialTimeRange]);

  // Trigger backtest when triggerRun changes (for predefined time ranges)
  useEffect(() => {
    if (triggerRun && triggerRun > 0) {
      handleRunBacktest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerRun]);

  const { dataFrames, historyRecords, commonLabels, totalRecordsCount } = useRuleHistoryRecords(
    stateHistory,
    instancesFilter
  );

  const { frameSubset, frameTimeRange } = useFrameSubset(dataFrames);

  const onLogRecordLabelClick = useCallback(
    (label: string) => {
      const matcherString = combineMatcherStrings(getValues('query'), label);
      setInstancesFilter(matcherString);
      setValue('query', matcherString);
    },
    [setInstancesFilter, setValue, getValues]
  );

  const onFilterCleared = useCallback(() => {
    setInstancesFilter('');
    setValue('query', '');
  }, [setInstancesFilter, setValue]);

  const hasMoreInstances = frameSubset.length < dataFrames.length;
  const hasResults = stateHistory !== undefined;
  const emptyStateMessage =
    totalRecordsCount > 0
      ? `No matches were found for the given filters among the ${totalRecordsCount} instances`
      : 'No state transitions occurred during the selected time range';

  return (
    <Collapse
      label={t('alerting.backtest.panel-title', 'Rule Retroactive Testing')}
      isOpen={isOpen}
      collapsible
      onToggle={onToggle}
    >
      <div className={styles.panelContent}>
        {/* Fixed controls section */}
        <div className={styles.controlsSection}>
          <Stack direction="row" alignItems="flex-end" justifyContent="flex-end">
            <TimeRangePicker
              value={timeRange}
              onChange={setTimeRange}
              onChangeTimeZone={() => {}}
              onMoveBackward={() => {}}
              onMoveForward={() => {}}
              onZoom={() => {}}
            />
            <RefreshPicker
              onRefresh={handleRunBacktest}
              onIntervalChanged={() => {}}
              isLoading={isLoading}
              noIntervalPicker={true}
            />
          </Stack>
        </div>

        {/* Scrollable results section */}
        <div className={styles.scrollableContent}>
          {isLoading && <LoadingPlaceholder text={t('alerting.backtest.loading', 'Running backtest...')} />}

          {error && <Alert title={t('alerting.backtest.error-title', 'Failed to run backtest')}>{error.message}</Alert>}

          {!isLoading && !error && hasResults && (
            <div className={styles.resultsContainer}>
              {!isEmpty(commonLabels) && (
                <Stack gap={1} alignItems="center" wrap="wrap">
                  <Stack gap={0.5} alignItems="center" minWidth="fit-content">
                    <Text variant="bodySmall">
                      <Trans i18nKey="alerting.loki-state-history.common-labels">Common labels</Trans>
                    </Text>
                    <Tooltip
                      content={t(
                        'alerting.loki-state-history.tooltip-common-labels',
                        'Common labels are the ones attached to all of the alert instances'
                      )}
                    >
                      <Icon name="info-circle" size="sm" />
                    </Tooltip>
                  </Stack>
                  <AlertLabels labels={fromPairs(commonLabels)} size="sm" />
                </Stack>
              )}
              {isEmpty(frameSubset) ? (
                <div className={styles.emptyState}>
                  {emptyStateMessage}
                  {totalRecordsCount > 0 && (
                    <Button variant="secondary" type="button" onClick={onFilterCleared}>
                      <Trans i18nKey="alerting.loki-state-history.clear-filters">Clear filters</Trans>
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <div className={styles.graphWrapper}>
                    <LogTimelineViewer frames={frameSubset} timeRange={frameTimeRange} />
                  </div>
                  {hasMoreInstances && (
                    <div className={styles.moreInstancesWarning}>
                      <Stack direction="row" alignItems="center" gap={1}>
                        <Icon name="exclamation-triangle" size="sm" />
                        <small>{`Only showing ${frameSubset.length} out of ${dataFrames.length} instances. Click on the labels to narrow down the results`}</small>
                      </Stack>
                    </div>
                  )}
                  <LogRecordViewerByTimestamp
                    records={historyRecords}
                    commonLabels={commonLabels}
                    onRecordsRendered={(recordRefs) => (logsRef.current = recordRefs)}
                    onLabelClick={onLogRecordLabelClick}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Collapse>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  panelContent: css({}),
  controlsSection: css({
    flexShrink: 0,
    paddingBottom: theme.spacing(2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  scrollableContent: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: theme.spacing(2),
    overflow: 'hidden',
  }),
  resultsContainer: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    flex: 1,
    overflow: 'hidden',
  }),
  graphWrapper: css({
    padding: `${theme.spacing()} 0`,
    overflowX: 'hidden',
  }),
  emptyState: css({
    color: theme.colors.text.secondary,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    margin: 'auto auto',
  }),
  moreInstancesWarning: css({
    color: theme.colors.warning.text,
    padding: theme.spacing(),
  }),
});
