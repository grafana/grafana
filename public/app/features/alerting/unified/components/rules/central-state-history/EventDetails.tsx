import { css } from '@emotion/css';
import { capitalize, max, min, uniqBy } from 'lodash';
import { useMemo } from 'react';

import { FieldType, GrafanaTheme2, LoadingState, PanelData, TimeRange, dateTime, makeTimeRange } from '@grafana/data';
import { Alert, Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { CombinedRule } from 'app/types/unified-alerting';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import { parse } from '../../../utils/rule-id';
import { MetaText } from '../../MetaText';
import { AnnotationValue } from '../../rule-viewer/tabs/Details';
import { LogTimelineViewer } from '../state-history/LogTimelineViewer';
import { useFrameSubset } from '../state-history/LokiStateHistory';
import { LogRecord } from '../state-history/common';
import { useRuleHistoryRecords } from '../state-history/useRuleHistoryRecords';

import { EventState, FilterType, LIMIT_EVENTS } from './EventListSceneObject';

interface EventDetailsProps {
  record: LogRecord;
  addFilter: (key: string, value: string, type: FilterType) => void;
  timeRange: TimeRange;
}
export function EventDetails({ record, addFilter, timeRange }: EventDetailsProps) {
  // get the rule from the ruleUID
  const ruleUID = record.line?.ruleUID ?? '';
  const labelsInInstance = record.line?.labels;
  const identifier = useMemo(() => {
    return parse(ruleUID, true);
  }, [ruleUID]);
  const { error, loading, result: rule } = useCombinedRule({ ruleIdentifier: identifier, limitAlerts: 0 }); // we limit the alerts to 0 as we only need the rule

  if (error) {
    return (
      <Text>
        <Trans i18nKey="alerting.central-alert-history.details.error">Error loading rule for this event.</Trans>
      </Text>
    );
  }
  if (loading) {
    return (
      <Text>
        <Trans i18nKey="alerting.central-alert-history.details.loading">Loading...</Trans>
      </Text>
    );
  }

  if (!rule) {
    return (
      <Text>
        <Trans i18nKey="alerting.central-alert-history.details.not-found">Rule not found for this event.</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={0.5}>
      <Stack direction={'row'} gap={6}>
        <StateTransition record={record} addFilter={addFilter} />
        <ValueInTransition record={record} />
      </Stack>
      <Annotations rule={rule} />
      <StateVisualization ruleUID={ruleUID} timeRange={timeRange} labels={labelsInInstance ?? {}} />
    </Stack>
  );
}

interface StateVisualizationProps {
  ruleUID: string;
  timeRange: TimeRange;
  labels: Record<string, string>;
}

/**
 * This component fetches the state history for the given ruleUID and time range, and displays the state transitions and the log timeline.
 * Fetching the state history for the alert rule uid, and labels,
 * makes the result to be more accurate, as it might be that we are not showing all the state transitions in the log records.
 * @param ruleUID
 * @param timeRange
 * @param labels
 * @returns
 */
function StateVisualization({ ruleUID, timeRange, labels }: StateVisualizationProps) {
  const { useGetRuleHistoryQuery } = stateHistoryApi;

  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery(
    {
      ruleUid: ruleUID,
      from: timeRange.from.unix(),
      to: timeRange.to.unix(),
      limit: LIMIT_EVENTS,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const { dataFrames } = useRuleHistoryRecords(
    stateHistory,
    labels
      ? Object.entries(labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(',')
      : ''
  );

  const { frameSubset, frameTimeRange } = useFrameSubset(dataFrames);

  if (isLoading) {
    return <div>
      <Trans i18nKey="alerting.central-alert-history.details.loading">
        Loading...
      </Trans>
    </div>;
  }
  if (isError) {
    return (
      <Alert title={t('alerting.central-alert-history.details.error-fetching.title', 'Error fetching the state history')} severity="error">
        {error instanceof Error
          ? error.message
          : t('alerting.central-alert-history.details.error-fetching.message', 'Unable to fetch alert state history')}
      </Alert>
    );
  }
  if (!frameSubset || frameSubset.length === 0) {
    return null;
  }

  const numberOfTransitions = dataFrames[0]?.fields[0]?.values?.length - 1 ?? 0; // we subtract 1 as the first value is the initial state

  return (
    <>
      <NumberTransitions transitions={ruleUID ? numberOfTransitions : 0} />
      <LogTimelineViewer frames={frameSubset} timeRange={frameTimeRange} />
    </>
  );
}

interface StateTransitionProps {
  record: LogRecord;
  addFilter: (key: string, value: string, type: FilterType) => void;
}
function StateTransition({ record, addFilter }: StateTransitionProps) {
  return (
    <Stack gap={0.5} direction={'column'}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="alerting.central-alert-history.details.state-transitions">State transition</Trans>
      </Text>
      <Stack gap={0.5} direction={'row'} alignItems="center">
        <EventState state={record.line.previous} showLabel addFilter={addFilter} type="from" />
        <Icon name="arrow-right" size="lg" />
        <EventState state={record.line.current} showLabel addFilter={addFilter} type="to" />
      </Stack>
    </Stack>
  );
}

interface AnnotationsProps {
  rule: CombinedRule;
}
const Annotations = ({ rule }: AnnotationsProps) => {
  const styles = useStyles2(getStyles);
  const annotations = rule.annotations;
  if (!annotations || Object.keys(annotations).length === 0) {
    return null;
  }
  return (
    <>
      <div className={styles.metadataWrapper}>
        {Object.entries(annotations).map(([name, value]) => {
          const capitalizedName = capitalize(name);
          return (
            <MetaText direction="column" key={capitalizedName}>
              {capitalizedName}
              <AnnotationValue value={value} />
            </MetaText>
          );
        })}
      </div>
    </>
  );
};

/**
 * This function returns the time series panel data for the condtion values of the rule, within the selected time range.
 * The values are extracted from the log records already fetched from the history api.
 * @param ruleUID
 * @param logRecords
 * @param condition
 * @returns PanelData
 */
export function getPanelDataForRule(ruleUID: string, logRecords: LogRecord[], condition: string) {
  const ruleLogRecords = logRecords
    .filter((record) => record.line.ruleUID === ruleUID)
    // sort by timestamp as time series data is expected to be sorted by time
    .sort((a, b) => a.timestamp - b.timestamp);

  // get unique records by timestamp, as timeseries data should have unique timestamps, and it might be possible to have multiple records with the same timestamp
  const uniqueRecords = uniqBy(ruleLogRecords, (record) => record.timestamp);

  const timestamps = uniqueRecords.map((record) => record.timestamp);
  const values = uniqueRecords.map((record) => (record.line.values ? record.line.values[condition] : 0));
  const minTimestamp = min(timestamps);
  const maxTimestamp = max(timestamps);

  const PanelDataObj: PanelData = {
    series: [
      {
        name: 'Rule condition history',
        fields: [
          { name: 'Time', values: timestamps, config: {}, type: FieldType.time },
          { name: 'values', values: values, type: FieldType.number, config: {} },
        ],
        length: timestamps.length,
      },
    ],
    state: LoadingState.Done,
    timeRange: makeTimeRange(dateTime(minTimestamp), dateTime(maxTimestamp)),
  };
  return PanelDataObj;
}

interface ValueInTransitionProps {
  record: LogRecord;
}
function ValueInTransition({ record }: ValueInTransitionProps) {
  const values = record?.line?.values
    ? JSON.stringify(record.line.values)
    : t('alerting.central-alert-history.details.no-values', 'No values');
  return (
    <Stack gap={0.5} direction={'column'}>
      <Text variant="body" weight="light" color="secondary">
        <Trans i18nKey="alerting.central-alert-history.details.value-in-transition">Value in transition</Trans>
      </Text>
      <Stack gap={0.5} direction={'row'} alignItems="center">
        <Text variant="body" weight="light">
          {values}
        </Text>
      </Stack>
    </Stack>
  );
}
interface NumberTransitionsProps {
  transitions: number;
}
function NumberTransitions({ transitions }: NumberTransitionsProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.transitionsNumber}>
      <Text variant="body" weight="bold" color="secondary">
        <Trans i18nKey="alerting.central-alert-history.details.number-transitions">
          State transitions for selected period:
        </Trans>
      </Text>
      <Text variant="body" weight="light">
        {transitions}
      </Text>
    </div>
  );
}
const getStyles = (theme: GrafanaTheme2) => {
  return {
    metadataWrapper: css({
      display: 'grid',
      gridTemplateColumns: 'auto auto',
      rowGap: theme.spacing(3),
      columnGap: theme.spacing(12),
    }),
    transitionsNumber: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(0.5),
      alignItems: 'center',
      marginTop: theme.spacing(1.5),
    }),
  };
};
