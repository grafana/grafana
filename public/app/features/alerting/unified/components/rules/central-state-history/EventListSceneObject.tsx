import { css, cx } from '@emotion/css';
import { ReactElement, useMemo, useState } from 'react';
import { useLocation } from 'react-router';
import { useMeasure } from 'react-use';

import { DataFrameJSON, GrafanaTheme2, IconName, TimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import {
  CustomVariable,
  SceneComponentProps,
  SceneObjectBase,
  TextBoxVariable,
  VariableValue,
  sceneGraph,
} from '@grafana/scenes';
import {
  Alert,
  Icon,
  IconButton,
  LoadingBar,
  Pagination,
  Stack,
  Text,
  Tooltip,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { Trans, t } from 'app/core/internationalization';
import {
  GrafanaAlertStateWithReason,
  isAlertStateWithReason,
  isGrafanaAlertState,
  mapStateWithReasonToBaseState,
  mapStateWithReasonToReason,
} from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { usePagination } from '../../../hooks/usePagination';
import { combineMatcherStrings, labelsMatchMatchers, parseMatchers } from '../../../utils/alertmanager';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { LogRecord } from '../state-history/common';
import { isLine, isNumbers } from '../state-history/useRuleHistoryRecords';

import { LABELS_FILTER, STATE_FILTER_FROM, STATE_FILTER_TO, StateFilterValues } from './CentralAlertHistoryScene';
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
  valueInLabelFilter: VariableValue;
  valueInStateToFilter: VariableValue;
  valueInStateFromFilter: VariableValue;
  addFilter: (key: string, value: string, type: FilterType) => void;
}
export const HistoryEventsList = ({
  timeRange,
  valueInLabelFilter,
  valueInStateToFilter,
  valueInStateFromFilter,
  addFilter,
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
    valueInLabelFilter.toString(),
    valueInStateToFilter.toString(),
    valueInStateFromFilter.toString(),
    stateHistory
  );

  const historyRecords = historyRecordsNotSorted.sort((a, b) => b.timestamp - a.timestamp);

  if (isError) {
    return <HistoryErrorMessage error={error} />;
  }

  return (
    <>
      <LoadingIndicator visible={isLoading} />
      <HistoryLogEvents logRecords={historyRecords} addFilter={addFilter} />
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
  addFilter: (key: string, value: string, type: FilterType) => void;
}
function HistoryLogEvents({ logRecords, addFilter }: HistoryLogEventsProps) {
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
              addFilter={addFilter}
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
  const title = t('alerting.central-alert-history.error', 'Something went wrong loading the alert state history');
  const errorStr = stringifyErrorLike(error);

  return <Alert title={title}>{errorStr}</Alert>;
}

interface EventRowProps {
  record: LogRecord;
  logRecords: LogRecord[];
  addFilter: (key: string, value: string, type: FilterType) => void;
}
function EventRow({ record, logRecords, addFilter }: EventRowProps) {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);
  function onLabelClick(label: string, value: string) {
    addFilter(label, value, 'label');
  }
  function addFilterByName(alertRuleName: string) {
    addFilter('alertname', alertRuleName, 'label');
  }

  return (
    <Stack direction="column" gap={0}>
      <div
        className={cx(styles.header, isCollapsed ? styles.collapsedHeader : styles.notCollapsedHeader)}
        data-testid="event-row-header"
      >
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
            <EventTransition previous={record.line.previous} current={record.line.current} addFilter={addFilter} />
          </div>
          <div className={styles.alertNameCol}>
            {record.line.labels ? (
              <AlertRuleName
                labels={record.line.labels}
                ruleUID={record.line.ruleUID}
                addFilterByName={addFilterByName}
              />
            ) : null}
          </div>
          <div className={styles.labelsCol}>
            <AlertLabels labels={record.line.labels ?? {}} size="xs" onLabelClick={onLabelClick} />
          </div>
        </Stack>
      </div>
      {!isCollapsed && (
        <div className={styles.expandedRow}>
          <EventDetails record={record} logRecords={logRecords} addFilter={addFilter} />
        </div>
      )}
    </Stack>
  );
}

interface AlertRuleNameProps {
  labels: Record<string, string>;
  ruleUID?: string;
  addFilterByName: (alertRuleName: string) => void;
}
function AlertRuleName({ labels, ruleUID, addFilterByName }: AlertRuleNameProps) {
  const styles = useStyles2(getStyles);
  const { pathname, search } = useLocation();
  const returnTo = encodeURIComponent(`${pathname}${search}`);
  const alertRuleName = labels['alertname'];
  if (!ruleUID) {
    return (
      <Text>
        <Trans i18nKey="alerting.central-alert-history.details.unknown-rule">Unknown</Trans>
      </Text>
    );
  }
  const ariaLabel = t('alerting.central-alert-history.details.add-filter', 'Add filter by alert name');
  return (
    <Stack gap={1} direction={'row'} alignItems="center">
      <Tooltip content={alertRuleName ?? ''}>
        <a
          href={`/alerting/${GRAFANA_RULES_SOURCE_NAME}/${ruleUID}/view?returnTo=${returnTo}`}
          className={styles.alertName}
        >
          {alertRuleName}
        </a>
      </Tooltip>
      <IconButton
        name="plus-circle"
        size="sm"
        onClick={() => addFilterByName(alertRuleName)}
        aria-label={ariaLabel}
        tooltip={ariaLabel}
        className={styles.colorIcon}
      />
    </Stack>
  );
}

interface EventTransitionProps {
  previous: GrafanaAlertStateWithReason;
  current: GrafanaAlertStateWithReason;
  addFilter: (key: string, value: string, type: FilterType) => void;
}
function EventTransition({ previous, current, addFilter }: EventTransitionProps) {
  return (
    <Stack gap={0.5} direction={'row'}>
      <EventState state={previous} addFilter={addFilter} type="from" />
      <Icon name="arrow-right" size="lg" />
      <EventState state={current} addFilter={addFilter} type="to" />
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
const StateIcon = ({ iconName, iconColor, tooltipContent, labelText, showLabel }: StateIconProps) => (
  <Tooltip content={tooltipContent} placement="top">
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
  addFilter: (key: string, value: string, type: FilterType) => void;
  type: 'from' | 'to';
}
export function EventState({ state, showLabel = false, addFilter, type }: EventStateProps) {
  const styles = useStyles2(getStyles);
  const toolTip = t('alerting.central-alert-history.details.no-recognized-state', 'No recognized state');
  if (!isGrafanaAlertState(state) && !isAlertStateWithReason(state)) {
    return (
      <StateIcon
        iconName="exclamation-triangle"
        tooltipContent={toolTip}
        labelText={<Trans i18nKey="alerting.central-alert-history.details.unknown-event-state">Unknown</Trans>}
        showLabel={showLabel}
        iconColor={styles.warningColor}
      />
    );
  }
  const baseState = mapStateWithReasonToBaseState(state);
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
      labelText: <Trans i18nKey="alerting.central-alert-history.details.state.normal">Normal</Trans>,
    },
    Alerting: {
      iconName: 'exclamation-circle',
      iconColor: styles.alertingColor,
      tooltipContent: 'Alerting',
      labelText: <Trans i18nKey="alerting.central-alert-history.details.state.alerting">Alerting</Trans>,
    },
    NoData: {
      iconName: 'exclamation-triangle',
      iconColor: styles.warningColor,
      tooltipContent: 'Insufficient data',
      labelText: <Trans i18nKey="alerting.central-alert-history.details.state.no-data">No data</Trans>,
    },
    Error: {
      iconName: 'exclamation-circle',
      tooltipContent: 'Error',
      iconColor: styles.warningColor,
      labelText: <Trans i18nKey="alerting.central-alert-history.details.state.error">Error</Trans>,
    },
    Pending: {
      iconName: 'circle',
      iconColor: styles.warningColor,
      tooltipContent: Boolean(reason) ? `Pending (${reason})` : 'Pending',
      labelText: <Trans i18nKey="alerting.central-alert-history.details.state.pending">Pending</Trans>,
    },
  };
  function onStateClick() {
    addFilter('state', baseState, type === 'from' ? 'stateFrom' : 'stateTo');
  }

  const config = stateConfig[baseState] || { iconName: 'exclamation-triangle', tooltipContent: 'Unknown State' };
  return (
    <div
      onClick={onStateClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onStateClick();
        }
      }}
      className={styles.state}
      role="button"
      tabIndex={0}
    >
      <StateIcon {...config} showLabel={showLabel} />
    </div>
  );
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
      '&:hover': {
        backgroundColor: theme.components.table.rowHoverBackground,
      },
    }),
    collapsedHeader: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    notCollapsedHeader: css({
      borderBottom: 'none',
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
    colorIcon: css({
      color: theme.colors.primary.text,
      '&:hover': {
        opacity: 0.8,
      },
    }),
    state: css({
      '&:hover': {
        opacity: 0.8,
        cursor: 'copy',
      },
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

export type FilterType = 'label' | 'stateFrom' | 'stateTo';

export function HistoryEventsListObjectRenderer({ model }: SceneComponentProps<HistoryEventsListObject>) {
  const { value: timeRange } = sceneGraph.getTimeRange(model).useState(); // get time range from scene graph
  // eslint-disable-next-line
  const labelsFiltersVariable = sceneGraph.lookupVariable(LABELS_FILTER, model)! as TextBoxVariable;
  // eslint-disable-next-line
  const stateToFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_TO, model)! as CustomVariable;
  // eslint-disable-next-line
  const stateFromFilterVariable = sceneGraph.lookupVariable(STATE_FILTER_FROM, model)! as CustomVariable;

  const valueInfilterTextBox: VariableValue = labelsFiltersVariable.getValue();
  const valueInStateToFilter = stateToFilterVariable.getValue();
  const valueInStateFromFilter = stateFromFilterVariable.getValue();

  const addFilter = (key: string, value: string, type: FilterType) => {
    const newFilterToAdd = `${key}=${value}`;
    if (type === 'stateTo') {
      stateToFilterVariable.changeValueTo(value);
    }
    if (type === 'stateFrom') {
      stateFromFilterVariable.changeValueTo(value);
    }
    if (type === 'label') {
      const finalFilter = combineMatcherStrings(valueInfilterTextBox.toString(), newFilterToAdd);
      labelsFiltersVariable.setValue(finalFilter);
    }
  };

  return (
    <HistoryEventsList
      timeRange={timeRange}
      valueInLabelFilter={valueInfilterTextBox}
      addFilter={addFilter}
      valueInStateToFilter={valueInStateToFilter}
      valueInStateFromFilter={valueInStateFromFilter}
    />
  );
}
/**
 * This hook filters the history records based on the label, stateTo and stateFrom filters.
 * @param filterInLabel
 * @param filterInStateTo
 * @param filterInStateFrom
 * @param stateHistory the original history records
 * @returns the filtered history records
 */
function useRuleHistoryRecords(
  filterInLabel: string,
  filterInStateTo: string,
  filterInStateFrom: string,
  stateHistory?: DataFrameJSON
) {
  return useMemo(() => {
    if (!stateHistory?.data) {
      return { historyRecords: [] };
    }

    const filterMatchers = filterInLabel ? parseMatchers(filterInLabel) : [];

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
      if (!isGrafanaAlertState(line.current) || !isGrafanaAlertState(line.previous)) {
        return acc;
      }
      const baseStateTo = mapStateWithReasonToBaseState(line.current);
      const baseStateFrom = mapStateWithReasonToBaseState(line.previous);
      const stateToMatch = filterInStateTo !== StateFilterValues.all ? filterInStateTo === baseStateTo : true;
      const stateFromMatch = filterInStateFrom !== StateFilterValues.all ? filterInStateFrom === baseStateFrom : true;
      if (filterMatch && stateToMatch && stateFromMatch) {
        acc.push({ timestamp, line });
      }

      return acc;
    }, []);

    return {
      historyRecords: logRecords,
    };
  }, [stateHistory, filterInLabel, filterInStateTo, filterInStateFrom]);
}
