import { css } from '@emotion/css';
import { capitalize, groupBy } from 'lodash';
import { useEffect, useMemo } from 'react';

import { DataFrame, DataFrameJSON, GrafanaTheme2, TimeRange } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Stack, Text, useStyles2, useTheme2 } from '@grafana/ui';
import { CombinedRule } from 'app/types/unified-alerting';

import { trackUseCentralHistoryExpandRow } from '../../../Analytics';
import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { useCombinedRule } from '../../../hooks/useCombinedRule';
import { labelsMatchMatchers } from '../../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../../utils/matchers';
import { parse } from '../../../utils/rule-id';
import { MetaText } from '../../MetaText';
import { AnnotationValue } from '../../rule-viewer/tabs/Details';
import { LogTimelineViewer } from '../state-history/LogTimelineViewer';
import { useFrameSubset } from '../state-history/LokiStateHistory';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { EventState, FilterType, LIMIT_EVENTS } from './EventListSceneObject';
import { HistoryErrorMessage } from './HistoryErrorMessage';
import { logRecordsToDataFrameForState } from './utils';

interface EventDetailsProps {
  record: LogRecord;
  addFilter: (key: string, value: string, type: FilterType) => void;
  timeRange: TimeRange;
}
export function EventDetails({ record, addFilter, timeRange }: EventDetailsProps) {
  // track the usage of the expand row
  useEffect(() => {
    trackUseCentralHistoryExpandRow();
  }, []);

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

function useRuleHistoryRecordsForTheInstance(labelsForTheInstance: string, stateHistory?: DataFrameJSON) {
  const theme = useTheme2();

  return useMemo(() => {
    // merge timestamp with "line"
    const tsValues = stateHistory?.data?.values[0] ?? [];
    const timestamps: number[] = isNumbers(tsValues) ? tsValues : [];
    const lines = stateHistory?.data?.values[1] ?? [];

    const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
      const line = lines[index];
      // values property can be undefined for some instance states (e.g. NoData)
      if (isLine(line)) {
        acc.push({ timestamp, line });
      }

      return acc;
    }, []);

    // group all records by alert instance (unique set of labels)
    const logRecordsByInstance = groupBy(logRecords, (record: LogRecord) => {
      return JSON.stringify(record.line.labels);
    });

    // filter by instance labels
    const filterMatchers = parsePromQLStyleMatcherLooseSafe(labelsForTheInstance);
    const filteredGroupedLines = Object.entries(logRecordsByInstance).filter(([key]) => {
      const labels = JSON.parse(key);
      return labelsMatchMatchers(labels, filterMatchers);
    });
    // Convert each group of log records to a DataFrame
    const dataFrames: DataFrame[] = Object.values(filteredGroupedLines).map<DataFrame>((records) => {
      // first element is the linstance labels, the second is the records list
      return logRecordsToDataFrameForState(records[1], theme);
    });
    return {
      dataFrames,
    };
  }, [stateHistory, labelsForTheInstance, theme]);
}

interface StateVisualizationProps {
  ruleUID: string;
  timeRange: TimeRange;
  labels: Record<string, string>;
}

/**
 * This component fetches the state history for the given ruleUID and time range, and displays the number of transitions and a State TimelineChart.
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

  const { dataFrames } = useRuleHistoryRecordsForTheInstance(
    labels
      ? Object.entries(labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(',')
      : '',
    stateHistory
  );

  const { frameSubset, frameTimeRange } = useFrameSubset(dataFrames);

  if (isLoading) {
    return (
      <div>
        <Trans i18nKey="alerting.central-alert-history.details.loading">Loading...</Trans>
      </div>
    );
  }
  if (isError) {
    return <HistoryErrorMessage error={error} />;
  }
  if (!frameSubset || frameSubset.length === 0) {
    return null;
  }

  // we subtract 1 as the first value is the initial state
  const numberOfTransitions = dataFrames[0]?.fields[0]?.values?.length - 1 || 0;

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
  );
};
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
