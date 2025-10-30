import { css } from '@emotion/css';
import { orderBy } from 'lodash';
import { Fragment, useMemo } from 'react';
import { useMeasure } from 'react-use';

import { AlertLabels } from '@grafana/alerting/unstable';
import { GrafanaTheme2, Labels } from '@grafana/data';
import { t } from '@grafana/i18n';
import { isFetchError } from '@grafana/runtime';
import { TimeRangePicker, useTimeRange } from '@grafana/scenes-react';
import { Alert, Box, Drawer, Icon, LoadingBar, Stack, Text, useStyles2 } from '@grafana/ui';
import { AlertQuery, GrafanaRuleDefinition } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { stateHistoryApi } from '../../api/stateHistoryApi';
import { getThresholdsForQueries } from '../../components/rule-editor/util';
import { EventState } from '../../components/rules/central-state-history/EventListSceneObject';
import { LogRecord, historyDataFrameToLogRecords } from '../../components/rules/state-history/common';
import { isAlertQueryOfAlertData } from '../../rule-editor/formProcessing';
import { stringifyErrorLike } from '../../utils/misc';

import { QueryVisualization } from './QueryVisualization';
import { convertStateHistoryToAnnotations } from './stateHistoryUtils';

const { useGetAlertRuleQuery } = alertRuleApi;
const { useGetRuleHistoryQuery } = stateHistoryApi;
const FIXED_DRAWER_WIDTH = '45%';

interface InstanceDetailsDrawerProps {
  ruleUID: string;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceDetailsDrawer({ ruleUID, instanceLabels, onClose }: InstanceDetailsDrawerProps) {
  const [ref, { width: loadingBarWidth }] = useMeasure<HTMLDivElement>();
  const [timeRange] = useTimeRange();

  const { data: rule, isLoading: loading, error } = useGetAlertRuleQuery({ uid: ruleUID });

  const { dataQueries, thresholds } = useMemo(() => {
    if (rule) {
      return extractQueryDetails(rule.grafana_alert);
    }
    return { dataQueries: [], thresholds: {} };
  }, [rule]);

  // Fetch state history for this specific instance
  const {
    data: stateHistoryData,
    isFetching: stateHistoryFetching,
    isError: stateHistoryError,
  } = useGetRuleHistoryQuery({
    ruleUid: ruleUID,
    labels: instanceLabels,
    from: timeRange.from.unix(),
    to: timeRange.to.unix(),
  });

  // Convert state history to LogRecords and filter by instance labels
  const { historyRecords, annotations } = useMemo(() => {
    const historyRecords = historyDataFrameToLogRecords(stateHistoryData);
    const annotations = convertStateHistoryToAnnotations(historyRecords);

    return { historyRecords, annotations };
  }, [stateHistoryData]);

  if (error) {
    return (
      <Drawer
        title={t('alerting.triage.instance-details', 'Instance Details')}
        onClose={onClose}
        width={FIXED_DRAWER_WIDTH}
      >
        <ErrorContent error={error} />
      </Drawer>
    );
  }

  if (loading || !rule) {
    return (
      <Drawer
        title={t('alerting.triage.instance-details', 'Instance Details')}
        onClose={onClose}
        width={FIXED_DRAWER_WIDTH}
      >
        <div>{t('alerting.common.loading', 'Loading...')}</div>
      </Drawer>
    );
  }

  return (
    <Drawer
      title={t('alerting.instance-details-drawer.title-instance-details', 'Instance Details')}
      onClose={onClose}
      width={FIXED_DRAWER_WIDTH}
    >
      <Stack direction="column" gap={3}>
        <Stack justifyContent="flex-end">
          <TimeRangePicker />
        </Stack>
        {dataQueries.length > 0 && (
          <Box>
            <Stack direction="column" gap={2}>
              {dataQueries.map((query, index) => (
                <QueryVisualization
                  key={query.refId || `query-${index}`}
                  query={query}
                  instanceLabels={instanceLabels}
                  thresholds={thresholds}
                  annotations={annotations}
                />
              ))}
            </Stack>
          </Box>
        )}

        <Box>
          <AlertLabels labels={instanceLabels} />
        </Box>

        <Box ref={ref}>
          <Text variant="h5">{t('alerting.instance-details.state-history', 'Recent State Changes')}</Text>
          {stateHistoryFetching && <LoadingBar width={loadingBarWidth} />}
          {stateHistoryError && (
            <Alert
              severity="error"
              title={t('alerting.instance-details.history-error', 'Failed to load state history')}
            >
              {t(
                'alerting.instance-details.history-error-desc',
                'Unable to fetch state transition history for this instance.'
              )}
            </Alert>
          )}
          {!stateHistoryFetching && !stateHistoryError && (
            <Stack direction="column" gap={1}>
              {historyRecords.length > 0 ? (
                <InstanceStateTransitions records={historyRecords} />
              ) : (
                <Text color="secondary">{t('alerting.instance-details.no-history', 'No recent state changes')}</Text>
              )}
            </Stack>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}

function extractQueryDetails(rule: GrafanaRuleDefinition) {
  const dataQueries = rule.data.filter((query: AlertQuery) => isAlertQueryOfAlertData(query));

  const allQueries = rule.data;
  const condition = rule.condition;

  const thresholds = getThresholdsForQueries(allQueries, condition);

  return { dataQueries, thresholds };
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatTimestamp(timestamp: number) {
  return dateFormatter.format(new Date(timestamp));
}

function InstanceStateTransitions({ records }: { records: LogRecord[] }) {
  const styles = useStyles2(stateTransitionStyles);
  const sortedRecords = orderBy(records, (r) => r.timestamp, 'desc');

  return (
    <div className={styles.container}>
      {sortedRecords.map((record, index) => (
        <Fragment key={`${record.timestamp}-${index}`}>
          <Text color="secondary" variant="bodySmall">
            {formatTimestamp(record.timestamp)}
          </Text>
          <EventState state={record.line.previous} showLabel addFilter={() => {}} type="from" />
          <Icon name="arrow-right" size="sm" />
          <EventState state={record.line.current} showLabel addFilter={() => {}} type="to" />
        </Fragment>
      ))}
    </div>
  );
}

const stateTransitionStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content max-content',
    gap: theme.spacing(1, 2),
    alignItems: 'center',
    padding: theme.spacing(1, 0),
  }),
});

interface ErrorContentProps {
  error: unknown;
}

function ErrorContent({ error }: ErrorContentProps) {
  if (isFetchError(error) && error.status === 404) {
    return (
      <Alert title={t('alerting.triage.rule-not-found.title', 'Rule not found')} severity="error">
        {t('alerting.triage.rule-not-found.description', 'The requested rule could not be found.')}
      </Alert>
    );
  }

  return (
    <Alert title={t('alerting.triage.error-loading-rule', 'Error loading rule')} severity="error">
      {stringifyErrorLike(error)}
    </Alert>
  );
}
