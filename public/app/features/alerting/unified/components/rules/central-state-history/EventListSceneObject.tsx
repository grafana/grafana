import { css } from '@emotion/css';
import { ReactElement, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataFrameJSON, GrafanaTheme2, IconName, TimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, TextBoxVariable, VariableValue, sceneGraph } from '@grafana/scenes';
import { Alert, Icon, LoadingBar, Pagination, Stack, Text, Tooltip, useStyles2, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { Trans, t } from 'app/core/internationalization';
import {
  GrafanaAlertState,
  GrafanaAlertStateWithReason,
  isAlertStateWithReason,
  isGrafanaAlertState,
  mapStateWithReasonToBaseState,
  mapStateWithReasonToReason,
} from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { usePagination } from '../../../hooks/usePagination';
import { labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { LABELS_FILTER } from './CentralAlertHistoryScene';
import { EventDetails } from './EventDetails';

export const LIMIT_EVENTS = 5000; // limit is hard-capped at 5000 at the BE level.
const PAGE_SIZE = 100;

/**
 *
 * This component displays a list of history events.
 * It fetches the events from the history api and displays them in a list.
 * The list is filtered by the labels in the filter variable and by the time range variable in the scene graph.
 */
interface HistoryEventsListProps {
  timeRange?: TimeRange;
  valueInfilterTextBox: VariableValue;
}
export const HistoryEventsList = ({
  timeRange,
  valueInfilterTextBox,
}: HistoryEventsListProps) => {
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
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(logRecords, 1, PAGE_SIZE);
  return (
    <Stack direction="column" gap={0}>
      <ul>
        {pageItems.map((record) => {
          return (
            <EventRow
              key={record.timestamp + (record.line.fingerprint ?? '')}
              record={record}
              logRecords={logRecords}
            />
          );
        })}
      </ul>
      {/* This paginations improves the performance considerably , making the page load faster */}
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </Stack>
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
  const errorStr = stringifyErrorLike(error);

  return (
    <Alert title={title}>
      <Trans i18nKey="central-alert-history.error-message" errorStr={errorStr}>
        {errorStr}
      </Trans>
    </Alert>
  );
}

interface EventRowProps {
  record: LogRecord;
  logRecords: LogRecord[];
}
function EventRow({ record, logRecords }: EventRowProps) {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);
  return (
    <Stack direction="column" gap={0}>
      <div className={styles.header(isCollapsed)} data-testid="event-row-header">
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
      {!isCollapsed && (
        <div className={styles.expandedRow}>
          <EventDetails record={record} logRecords={logRecords} />
        </div>
      )}
    </Stack>
  );
}

interface AlertRuleNameProps {
  labels: Record<string, string>;
  ruleUID?: string;
}
function AlertRuleName({ labels, ruleUID }: AlertRuleNameProps) {
  const styles = useStyles2(getStyles);
  const alertRuleName = labels['alertname'];
  if (!ruleUID) {
    return (
      <Text>
        <Trans i18nKey="central-alert-history.details.unknown-rule">Unknown</Trans>
        <Trans i18nKey="central-alert-history.details.alert-name" alertRuleName={alertRuleName}>
          {alertRuleName}
        </Trans>
      </Text>
    );
  }
  return (
    <Tooltip content={alertRuleName ?? ''}>
      <a
        href={`/alerting/${GRAFANA_RULES_SOURCE_NAME}/${ruleUID}/view?returnTo=${encodeURIComponent('/alerting/history')}`}
        className={styles.alertName}
      >
        <Trans i18nKey="central-alert-history.details.alert-name" alertRuleName={alertRuleName}>
          {alertRuleName}
        </Trans>
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

interface StateIconProps {
  iconName: IconName;
  iconColor: string;
  tooltipContent: string;
  labelText: ReactElement;
  showLabel: boolean;
}
const StateIcon = ({
  iconName,
  iconColor,
  tooltipContent,
  labelText,
  showLabel,
}: StateIconProps) => (
  <Tooltip content={tooltipContent}>
    <Stack gap={0.5} direction={'row'} alignItems="center">
      <Icon name={iconName} size="md" className={iconColor} />
      {showLabel && (
        <Text variant="body" weight="light">
          {labelText}
        </Text>
      )}
    </Stack>
  </Tooltip>
);

interface EventStateProps {
  state: GrafanaAlertStateWithReason;
  showLabel?: boolean;
}
export function EventState({ state, showLabel }: EventStateProps) {
  const styles = useStyles2(getStyles);
  if (!isGrafanaAlertState(state) && !isAlertStateWithReason(state)) {
    return (
      <StateIcon
        iconName="exclamation-triangle"
        tooltipContent="No recognized state"
        labelText={<Trans i18nKey="central-alert-history.details.unknown-event-state">Unknown</Trans>}
        showLabel={Boolean(showLabel)}
        iconColor={styles.warningColor}
      />
    );
  }
  // typescript doesn't know that baseState is a GrafanaAlertState even though we've checked it above
  // eslint-disable-next-line
  const baseState = mapStateWithReasonToBaseState(state) as GrafanaAlertState;
  const reason = mapStateWithReasonToReason(state);
  interface StateConfig {
    iconName: IconName;
    iconColor: string;
    tooltipContent: string;
    labelText: ReactElement;
  }
  interface StateConfigMap {
    [key: string]: StateConfig;
  }
  const stateConfig: StateConfigMap = {
    Normal: {
      iconName: 'check-circle',
      iconColor: Boolean(reason) ? styles.warningColor : styles.normalColor,
      tooltipContent: Boolean(reason) ? `Normal (${reason})` : 'Normal',
      labelText: <Trans i18nKey="central-alert-history.details.state.normal">Normal</Trans>,
    },
    Alerting: {
      iconName: 'exclamation-circle',
      iconColor: styles.alertingColor,
      tooltipContent: 'Alerting',
      labelText: <Trans i18nKey="central-alert-history.details.state.alerting">Alerting</Trans>,
    },
    NoData: {
      iconName: 'exclamation-triangle',
      iconColor: styles.warningColor,
      tooltipContent: 'Insufficient data',
      labelText: <Trans i18nKey="central-alert-history.details.state.no-data">No data</Trans>,
    },
    Error: {
      iconName: 'exclamation-circle',
      tooltipContent: 'Error',
      iconColor: styles.warningColor,
      labelText: <Trans i18nKey="central-alert-history.details.state.error">Error</Trans>,
    },
    Pending: {
      iconName: 'circle',
      iconColor: styles.warningColor,
      tooltipContent: Boolean(reason) ? `Pending (${reason})` : 'Pending',
      labelText: <Trans i18nKey="central-alert-history.details.state.pending">Pending</Trans>,
    },
  };

  const config = stateConfig[baseState] || { iconName: 'exclamation-triangle', tooltipContent: 'Unknown State' };
  return <StateIcon {...config} showLabel={Boolean(showLabel)} />;
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
      <Trans i18nKey="central-alert-history.details.timestamp" formattedDate={formattedDate}>
        {formattedDate}
      </Trans>
    </Text>
  );
};

export default withErrorBoundary(HistoryEventsList, { style: 'page' });

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: (isCollapsed: boolean) =>
      css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        padding: `${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)} 0`,
        flexWrap: 'nowrap',
        borderBottom: isCollapsed ? `1px solid ${theme.colors.border.weak}` : 'none',

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
    expandedRow: css({
      padding: theme.spacing(2),
      marginLeft: theme.spacing(2),
      borderLeft: `1px solid ${theme.colors.border.weak}`,
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
    if (!stateHistory?.data) {
      return { historyRecords: [] };
    }

    const filterMatchers = filter ? parseMatchers(filter) : [];

    const [tsValues, lines] = stateHistory.data.values;
    const timestamps = isNumbers(tsValues) ? tsValues : [];

    // merge timestamp with "line"
    const logRecords = timestamps.reduce((acc: LogRecord[], timestamp: number, index: number) => {
      const line = lines[index];
      if (!isLine(line)) {
        return acc;
      }

      // values property can be undefined for some instance states (e.g. NoData)
      const filterMatch = line.labels && labelsMatchMatchers(line.labels, filterMatchers);
      if (filterMatch) {
        acc.push({ timestamp, line });
      }

      return acc;
    }, []);

    return {
      historyRecords: logRecords,
    };
  }, [stateHistory, filter]);
}
