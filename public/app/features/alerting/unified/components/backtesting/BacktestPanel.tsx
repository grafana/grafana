import { css } from '@emotion/css';
import { fromPairs, isEmpty, isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { DataFrameJSON, GrafanaTheme2, TimeRange, rangeUtil } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Icon,
  LoadingPlaceholder,
  RefreshPicker,
  Stack,
  Text,
  TimeRangePicker,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { useRunBacktestMutation } from '../../api/backtestApi';
import { RuleFormValues } from '../../types/rule-form';
import { combineMatcherStrings } from '../../utils/alertmanager';
import { messageFromError } from '../../utils/redux';
import { formValuesToRulerGrafanaRuleDTO } from '../../utils/rule-form';
import { LogRecordViewerByTimestamp } from '../rules/state-history/LogRecordViewer';
import { LogTimelineViewer } from '../rules/state-history/LogTimelineViewer';
import { useFrameSubset } from '../rules/state-history/LokiStateHistory';
import { useRuleHistoryRecords } from '../rules/state-history/useRuleHistoryRecords';

interface BacktestPanelProps {
  ruleDefinition: RuleFormValues;
  initialTimeRange?: TimeRange;
}

export function BacktestPanel({ ruleDefinition, initialTimeRange }: BacktestPanelProps) {
  const styles = useStyles2(getStyles);
  const [timeRange, setTimeRange] = useState<TimeRange>(
    initialTimeRange || rangeUtil.convertRawToRange({ from: 'now-15m', to: 'now' })
  );
  const [stateHistory, setStateHistory] = useState<DataFrameJSON>();
  const [instancesFilter, setInstancesFilter] = useState('');
  const shouldRunInitialBacktest = useRef(!!initialTimeRange);

  const [runBacktest, { isLoading, error: mutationError }] = useRunBacktestMutation();

  const handleRunBacktest = useCallback(async () => {
    // Convert form values to the proper AlertRule format
    const alertRule = formValuesToRulerGrafanaRuleDTO(ruleDefinition);

    // Build requestBody matching BacktestConfig struct
    const requestBody = {
      // Required time range fields
      from: timeRange.from.toISOString(),
      to: timeRange.to.toISOString(),
      interval: ruleDefinition.evaluateEvery,

      // Required alert definition fields
      condition: alertRule.grafana_alert.condition,
      data: alertRule.grafana_alert.data,
      title: alertRule.grafana_alert.title,
      no_data_state: alertRule.grafana_alert.no_data_state,
      exec_err_state: alertRule.grafana_alert.exec_err_state,

      // Optional duration fields
      for: alertRule.for,
      keep_firing_for: alertRule.keep_firing_for,

      // Optional metadata fields
      labels: alertRule.labels,
      missing_series_evals_to_resolve: alertRule.grafana_alert.missing_series_evals_to_resolve,

      // Optional rule identification fields
      uid: alertRule.grafana_alert.uid,
      rule_group: ruleDefinition.group,
      namespace_uid: ruleDefinition.folder?.uid,
    };

    try {
      const result = await runBacktest(requestBody).unwrap();
      setStateHistory(result);
    } catch (err) {
      // Error is handled by RTK Query and available via mutationError
    }
  }, [ruleDefinition, timeRange, runBacktest]);

  // Update time range when initialTimeRange prop changes
  useEffect(() => {
    if (initialTimeRange) {
      setTimeRange(initialTimeRange);
    }
  }, [initialTimeRange]);

  // Run backtest once after initial mount when timeRange is synchronized with initialTimeRange
  useEffect(() => {
    if (shouldRunInitialBacktest.current && initialTimeRange && isEqual(timeRange, initialTimeRange)) {
      shouldRunInitialBacktest.current = false;
      handleRunBacktest();
    }
  }, [initialTimeRange, timeRange, handleRunBacktest]);

  const { dataFrames, historyRecords, commonLabels } = useRuleHistoryRecords(
    stateHistory,
    instancesFilter
  );

  const { frameSubset, frameTimeRange } = useFrameSubset(dataFrames);

  const onLogRecordLabelClick = useCallback(
    (label: string) => {
      const matcherString = combineMatcherStrings(instancesFilter, label);
      setInstancesFilter(matcherString);
    },
    [instancesFilter]
  );

  const hasResults = stateHistory !== undefined;

  const notices = stateHistory?.schema?.meta?.notices || [];
  const errorMessage = mutationError ? messageFromError(mutationError) : null;

  return (
    <div>
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
      <div className={styles.scrollableContent}>
        {isLoading && <LoadingPlaceholder text={t('alerting.backtest.loading', 'Running backtest...')} />}

        {errorMessage && (
          <Alert title={t('alerting.backtest.error-title', 'Failed to run backtest')}>{errorMessage}</Alert>
        )}

        {!isLoading && !mutationError && hasResults && notices.length > 0 && (
          <Stack direction="column" gap={1}>
            {notices.map((notice, index) => (
              <Alert key={index} severity={notice.severity || 'info'} title="">
                {notice.text}
              </Alert>
            ))}
          </Stack>
        )}

        {!isLoading && !mutationError && hasResults && (
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
            <LogTimelineViewer frames={frameSubset} timeRange={frameTimeRange} />
            <LogRecordViewerByTimestamp
              records={historyRecords}
              commonLabels={commonLabels}
              onLabelClick={onLogRecordLabelClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
 const getStyles = (theme: GrafanaTheme2) => ({
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
});
