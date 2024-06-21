import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrameJSON, GrafanaTheme2, TimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, TextBoxVariable, VariableValue, sceneGraph } from '@grafana/scenes';
import { Alert, Icon, LoadingBar, Stack, Text, Tooltip, useStyles2, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { t } from 'app/core/internationalization';
import {
  GrafanaAlertStateWithReason,
  isAlertStateWithReason,
  isGrafanaAlertState,
  mapStateWithReasonToBaseState,
  mapStateWithReasonToReason,
} from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { hashLabelsOrAnnotations } from '../../../utils/rule-id';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { LABELS_FILTER } from './CentralAlertHistoryScene';

export const LIMIT_EVENTS = 5000; // limit is hard-capped at 5000 at the BE level.

/**
 *
 * This component displays a list of history events.
 * It fetches the events from the history api and displays them in a list.
 * The list is filtered by the labels in the filter variable and by the time range variable in the scene graph.
 */
export const HistoryEventsList = ({
  timeRange,
  valueInfilterTextBox,
}: {
  timeRange?: TimeRange;
  valueInfilterTextBox: VariableValue;
}) => {
  const from = timeRange?.from.unix();
  const to = timeRange?.to.unix();

  const {
    data: stateHistory,
    isLoading,
    isError,
    error,
  } = stateHistoryApi.endpoints.getRuleHistory.useQuery({
    from: from,
    to: to,
    limit: LIMIT_EVENTS,
  });

  const { historyRecords: historyRecordsNotSorted } = useRuleHistoryRecords(
    stateHistory,
    valueInfilterTextBox.toString()
  );

  const historyRecords = historyRecordsNotSorted.sort((a, b) => b.timestamp - a.timestamp);

  if (isError) {
    return <HistoryErrorMessage error={error} />;
  }

  return (
    <>
      <LoadingIndicator visible={isLoading} />
      <HistoryLogEvents logRecords={historyRecords} />
    </>
  );
};

// todo: this function has been copied from RuleList.v2.tsx, should be moved to a shared location
const LoadingIndicator = ({ visible = false }) => {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  return <div ref={measureRef}>{visible && <LoadingBar width={width} data-testid="loading-bar" />}</div>;
};

interface HistoryLogEventsProps {
  logRecords: LogRecord[];
}
function HistoryLogEvents({ logRecords }: HistoryLogEventsProps) {
  return (
    <ul>
      {logRecords.map((record) => {
        return <EventRow key={record.timestamp + hashLabelsOrAnnotations(record.line.labels ?? {})} record={record} />;
      })}
    </ul>
  );
}

interface HistoryErrorMessageProps {
  error: unknown;
}

function HistoryErrorMessage({ error }: HistoryErrorMessageProps) {
  if (isFetchError(error) && error.status === 404) {
    return <EntityNotFound entity="History" />;
  }
  const title = t('central-alert-history.error', 'Something went wrong loading the alert state history');

  return <Alert title={title}>{stringifyErrorLike(error)}</Alert>;
}

function EventRow({ record }: { record: LogRecord }) {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);
  return (
    <div>
      <div className={styles.header} data-testid="event-row-header">
        <CollapseToggle
          size="sm"
          className={styles.collapseToggle}
          isCollapsed={isCollapsed}
          onToggle={setIsCollapsed}
        />
        <Stack gap={0.5} direction={'row'} alignItems={'center'}>
          <div className={styles.timeCol}>
            <Timestamp time={record.timestamp} />
          </div>
          <div className={styles.transitionCol}>
            <EventTransition previous={record.line.previous} current={record.line.current} />
          </div>
          <div className={styles.alertNameCol}>
            {record.line.labels ? <AlertRuleName labels={record.line.labels} ruleUID={record.line.ruleUID} /> : null}
          </div>
          <div className={styles.labelsCol}>
            <AlertLabels labels={record.line.labels ?? {}} size="xs" />
          </div>
        </Stack>
      </div>
    </div>
  );
}

function AlertRuleName({ labels, ruleUID }: { labels: Record<string, string>; ruleUID?: string }) {
  const styles = useStyles2(getStyles);
  const alertRuleName = labels['alertname'];
  if (!ruleUID) {
    return <Text>{alertRuleName}</Text>;
  }
  return (
    <Tooltip content={alertRuleName ?? ''}>
      <a
        href={`/alerting/${GRAFANA_RULES_SOURCE_NAME}/${ruleUID}/view?returnTo=${encodeURIComponent('/alerting/history')}`}
        className={styles.alertName}
      >
        {alertRuleName}
      </a>
    </Tooltip>
  );
}

interface EventTransitionProps {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
}
function EventTransition({ previous, current }: EventTransitionProps) {
  return (
    <Stack gap={0.5} direction={'row'}>
      <EventState state={previous} />
      <Icon name="arrow-right" size="lg" />
      <EventState state={current} />
    </Stack>
  );
}

function EventState({ state }: { state: GrafanaAlertStateWithReason }) {
  const styles = useStyles2(getStyles);

  if (!isGrafanaAlertState(state) && !isAlertStateWithReason(state)) {
    return (
      <Tooltip content={'No recognized state'}>
        <Icon name="exclamation-triangle" size="md" />
      </Tooltip>
    );
  }
  const baseState = mapStateWithReasonToBaseState(state);
  const reason = mapStateWithReasonToReason(state);

  switch (baseState) {
    case 'Normal':
      return (
        <Tooltip content={Boolean(reason) ? `Normal (${reason})` : 'Normal'}>
          <Icon name="check-circle" size="md" className={Boolean(reason) ? styles.warningColor : styles.normalColor} />
        </Tooltip>
      );
    case 'Alerting':
      return (
        <Tooltip content={'Alerting'}>
          <Icon name="exclamation-circle" size="md" className={styles.alertingColor} />
        </Tooltip>
      );
    case 'NoData': //todo:change icon
      return (
        <Tooltip content={'Insufficient data'}>
          <Icon name="exclamation-triangle" size="md" className={styles.warningColor} />
          {/* no idea which icon to use */}
        </Tooltip>
      );
    case 'Error':
      return (
        <Tooltip content={'Error'}>
          <Icon name="exclamation-circle" size="md" />
        </Tooltip>
      );

    case 'Pending':
      return (
        <Tooltip content={Boolean(reason) ? `Pending (${reason})` : 'Pending'}>
          <Icon name="circle" size="md" className={styles.warningColor} />
        </Tooltip>
      );
    default:
      return <Icon name="exclamation-triangle" size="md" />;
  }
}

interface TimestampProps {
  time: number; // epoch timestamp
}

const Timestamp = ({ time }: TimestampProps) => {
  const dateTime = new Date(time);
  const formattedDate = dateTime.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return (
    <Text variant="body" weight="light">
      {formattedDate}
    </Text>
  );
};

export default withErrorBoundary(HistoryEventsList, { style: 'page' });

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: `${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0`,
      flexWrap: 'nowrap',
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      '&:hover': {
        backgroundColor: theme.components.table.rowHoverBackground,
      },
    }),

    collapseToggle: css({
      background: 'none',
      border: 'none',
      marginTop: `-${theme.spacing(1)}`,
      marginBottom: `-${theme.spacing(1)}`,

      svg: {
        marginBottom: 0,
      },
    }),
    normalColor: css({
      fill: theme.colors.success.text,
    }),
    warningColor: css({
      fill: theme.colors.warning.text,
    }),
    alertingColor: css({
      fill: theme.colors.error.text,
    }),
    timeCol: css({
      width: '150px',
    }),
    transitionCol: css({
      width: '80px',
    }),
    alertNameCol: css({
      width: '300px',
    }),
    labelsCol: css({
      display: 'flex',
      overflow: 'hidden',
      alignItems: 'center',
      paddingRight: theme.spacing(2),
      flex: 1,
    }),
    alertName: css({
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'block',
      color: theme.colors.text.link,
    }),
  };
};

/**
 * This is a scene object that displays a list of history events.
 */

export class HistoryEventsListObject extends SceneObjectBase {
  public static Component = HistoryEventsListObjectRenderer;
  public constructor() {
    super({});
  }
}

export function HistoryEventsListObjectRenderer({ model }: SceneComponentProps<HistoryEventsListObject>) {
  const { value: timeRange } = sceneGraph.getTimeRange(model).useState(); // get time range from scene graph
  const filtersVariable = sceneGraph.lookupVariable(LABELS_FILTER, model)!;

  const valueInfilterTextBox: VariableValue = !(filtersVariable instanceof TextBoxVariable)
    ? ''
    : filtersVariable.getValue();

  return <HistoryEventsList timeRange={timeRange} valueInfilterTextBox={valueInfilterTextBox} />;
}

function useRuleHistoryRecords(stateHistory?: DataFrameJSON, filter?: string) {
  return useMemo(() => {
    const tsValues = stateHistory?.data?.values[0] ?? [];
    const timestamps: number[] = isNumbers(tsValues) ? tsValues : [];
    const lines = stateHistory?.data?.values[1] ?? [];
    // merge timestamp with "line"
    const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
      const line = lines[index];
      // values property can be undefined for some instance states (e.g. NoData)
      if (isLine(line)) {
        acc.push({ timestamp, line });
      }
      return acc;
    }, []);

    const filterMatchers = filter ? parseMatchers(filter) : [];

    return {
      historyRecords: logRecords.filter(({ line }) => line.labels && labelsMatchMatchers(line.labels, filterMatchers)),
    };
  }, [stateHistory, filter]);
}
