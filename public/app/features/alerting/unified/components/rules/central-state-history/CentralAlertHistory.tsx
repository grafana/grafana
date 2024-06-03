import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMeasure } from 'react-use';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { SceneComponentProps, SceneObjectBase, sceneGraph } from '@grafana/scenes';
import {
  Alert,
  Button,
  Field,
  Icon,
  Input,
  Label,
  LoadingBar,
  Stack,
  Text,
  Tooltip,
  useStyles2,
  withErrorBoundary,
} from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';
import { GrafanaAlertStateWithReason, isGrafanaAlertState } from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { GRAFANA_DATASOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { STATE_HISTORY_POLLING_INTERVAL } from '../state-history/LokiStateHistory';
import { LogRecord } from '../state-history/common';
import { useRuleHistoryRecords } from '../state-history/useRuleHistoryRecords';

const LIMIT_LABELS = 2;
const LIMIT_EVENTS = 250;

const HistoryEventsList = ({ timeRange }: { timeRange?: TimeRange }) => {
  const styles = useStyles2(getStyles);
  const { useGetRuleHistoryQuery } = stateHistoryApi;
  // Filter state
  const [eventsFilter, setEventsFilter] = useState('');
  // form for filter fields
  const { setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } }); //  form for search field
  const from = timeRange?.from.unix();
  const to = timeRange?.to.unix();
  const onFilterCleared = useCallback(() => {
    setEventsFilter('');
    setValue('query', '');
  }, [setEventsFilter, setValue]);

  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery(
    {
      from: from,
      to: to,
      limit: LIMIT_EVENTS,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: STATE_HISTORY_POLLING_INTERVAL,
    }
  );

  const { historyRecords } = useRuleHistoryRecords(stateHistory, eventsFilter);

  if (isError) {
    return <HistoryErrorMessage error={error} />;
  }

  return (
    <Stack direction="column" gap={1}>
      <Stack gap={1} direction="row" justifyContent={'space-between'}>
        <div className={styles.labelsFilter}>
          <form onSubmit={handleSubmit((data) => setEventsFilter(data.query))}>
            <SearchFieldInput
              {...register('query')}
              showClearFilterSuffix={!!eventsFilter}
              onClearFilterClick={onFilterCleared}
            />
            <input type="submit" hidden />
          </form>
        </div>
      </Stack>
      <LoadingIndicator visible={isLoading} />
      <HistoryLogEvents logRecords={historyRecords} />
    </Stack>
  );
};

// todo: this function has been copied from RuleList.v2.tsx, should be moved to a shared location
const LoadingIndicator = ({ visible = false }) => {
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  return <div ref={measureRef}>{visible && <LoadingBar width={width} />}</div>;
};

interface HistoryLogEventsProps {
  logRecords: LogRecord[];
}
function HistoryLogEvents({ logRecords }: HistoryLogEventsProps) {
  // display log records
  return (
    <ul>
      {logRecords.map((record, index) => {
        return <EventRow key={index} record={record} />;
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

  return <Alert title={'Something went wrong loading the alert state history'}>{stringifyErrorLike(error)}</Alert>;
}

interface SearchFieldInputProps {
  showClearFilterSuffix: boolean;
  onClearFilterClick: () => void;
}
const SearchFieldInput = React.forwardRef<HTMLInputElement, SearchFieldInputProps>(
  ({ showClearFilterSuffix, onClearFilterClick, ...rest }: SearchFieldInputProps, ref) => {
    return (
      <Field
        label={
          <Label htmlFor="eventsSearchInput">
            <Stack gap={0.5}>
              <span>Filter events</span>
            </Stack>
          </Label>
        }
      >
        <Input
          id="eventsSearchInput"
          prefix={<Icon name="search" />}
          suffix={
            showClearFilterSuffix && (
              <Button fill="text" icon="times" size="sm" onClick={onClearFilterClick}>
                Clear
              </Button>
            )
          }
          placeholder="Filter events in the list by labels"
          ref={ref}
          {...rest}
        />
      </Field>
    );
  }
);

SearchFieldInput.displayName = 'SearchFieldInput';

function EventRow({ record }: { record: LogRecord }) {
  const styles = useStyles2(getStyles);
  const [isCollapsed, setIsCollapsed] = useState(true);
  return (
    <div>
      <div className={styles.header} data-testid="rule-group-header">
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
            <AlertLabels labels={record.line.labels ?? {}} limit={LIMIT_LABELS} />
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
    <a href={`/alerting/${GRAFANA_DATASOURCE_NAME}/${ruleUID}/view`} className={styles.alertName}>
      {alertRuleName}
    </a>
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
  if (!isGrafanaAlertState(state)) {
    // missing series , not sure what to render here. They are always normal state?
    return (
      <Tooltip content={'Missing series'}>
        <Icon name="check" size="md" className={styles.normalColor} />
      </Tooltip>
    );
  }
  switch (state) {
    case 'Normal':
      return <Icon name="check" size="md" className={styles.normalColor} />;
    case 'Alerting':
      return <Icon name="exclamation-circle" size="md" className={styles.alertingColor} />;
    case 'NoData': //todo: add tooltip and change icon
      return <Icon name="cloud" size="md" />; // no idea which icon to use
    case 'Error':
      return <Icon name="exclamation-circle" size="md" />;
    case 'Pending':
      return <Icon name="hourglass" size="md" />;
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
      width: '500px',
    }),
    alertName: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'block',
      color: theme.colors.text.link,
    }),
    labelsFilter: css({
      width: '100%',
      paddingTop: theme.spacing(4),
    }),
  };
};

class HistoryEventsListObject extends SceneObjectBase {
  public static Component = ({ model }: SceneComponentProps<HistoryEventsListObject>) => {
    const { value: timeRange } = sceneGraph.getTimeRange(model).useState();

    return <HistoryEventsList timeRange={timeRange} />;
  };
}

export function HistoryEventsListObjectRenderer({ model }: SceneComponentProps<HistoryEventsListObject>) {
  const { value: timeRange } = sceneGraph.getTimeRange(model).useState(); // get time range from scene graph

  return <HistoryEventsList timeRange={timeRange} />;
}
