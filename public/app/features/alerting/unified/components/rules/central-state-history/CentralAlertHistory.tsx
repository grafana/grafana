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
import { Trans, t } from 'app/core/internationalization';
import {
  GrafanaAlertStateWithReason,
  isAlertStateWithReason,
  isGrafanaAlertState,
  mapStateWithReasonToBaseState,
  mapStateWithReasonToReason,
} from 'app/types/unified-alerting-dto';

import { stateHistoryApi } from '../../../api/stateHistoryApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../utils/datasource';
import { stringifyErrorLike } from '../../../utils/misc';
import { hashLabelsOrAnnotations } from '../../../utils/rule-id';
import { AlertLabels } from '../../AlertLabels';
import { CollapseToggle } from '../../CollapseToggle';
import { LogRecord } from '../state-history/common';
import { useRuleHistoryRecords } from '../state-history/useRuleHistoryRecords';

const LIMIT_EVENTS = 250;

const HistoryEventsList = ({ timeRange }: { timeRange?: TimeRange }) => {
  const styles = useStyles2(getStyles);

  // Filter state
  const [eventsFilter, setEventsFilter] = useState('');
  // form for filter fields
  const { register, handleSubmit, reset } = useForm({ defaultValues: { query: '' } }); //  form for search field
  const from = timeRange?.from.unix();
  const to = timeRange?.to.unix();
  const onFilterCleared = useCallback(() => {
    setEventsFilter('');
    reset();
  }, [setEventsFilter, reset]);

  const {
    data: stateHistory,
    isLoading,
    isError,
    error,
  } = stateHistoryApi.endpoints.getRuleHistory.useQuery(
    {
      from: from,
      to: to,
      limit: LIMIT_EVENTS,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
    }
  );

  const { historyRecords } = useRuleHistoryRecords(stateHistory, eventsFilter);

  if (isError) {
    return <HistoryErrorMessage error={error} />;
  }

  return (
    <Stack direction="column" gap={1}>
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

interface SearchFieldInputProps {
  showClearFilterSuffix: boolean;
  onClearFilterClick: () => void;
}
const SearchFieldInput = React.forwardRef<HTMLInputElement, SearchFieldInputProps>(
  ({ showClearFilterSuffix, onClearFilterClick, ...rest }: SearchFieldInputProps, ref) => {
    const placeholder = t('central-alert-history.filter.placeholder', 'Filter events in the list with labels');
    return (
      <Field
        label={
          <Label htmlFor="eventsSearchInput">
            <Stack gap={0.5}>
              <span>
                <Trans i18nKey="central-alert-history.filter.label">Filter events</Trans>
              </span>
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
                <Trans i18nKey="central-alert-history.filter.button.clear">Clear</Trans>
              </Button>
            )
          }
          placeholder={placeholder}
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
    labelsFilter: css({
      width: '100%',
      paddingTop: theme.spacing(4),
    }),
  };
};

export class HistoryEventsListObject extends SceneObjectBase {
  public static Component = HistoryEventsListObjectRenderer;
}

export function HistoryEventsListObjectRenderer({ model }: SceneComponentProps<HistoryEventsListObject>) {
  const { value: timeRange } = sceneGraph.getTimeRange(model).useState(); // get time range from scene graph

  return <HistoryEventsList timeRange={timeRange} />;
}
