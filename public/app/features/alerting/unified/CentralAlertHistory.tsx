import React, { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { NavModelItem, getDefaultTimeRange } from '@grafana/data';
import { isFetchError } from '@grafana/runtime';
import { Alert, Button, Field, Icon, Input, Label, Stack, withErrorBoundary } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { stateHistoryApi } from './api/stateHistoryApi';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { STATE_HISTORY_POLLING_INTERVAL } from './components/rules/state-history/LokiStateHistory';
import { LogRecord } from './components/rules/state-history/common';
import { useRuleHistoryRecords } from './components/rules/state-history/useRuleHistoryRecords';
import { stringifyErrorLike } from './utils/misc';

const CentralAlertHistory = (): JSX.Element => {
  const { useGetRuleHistoryQuery } = stateHistoryApi;
  // Filter state
  const [eventsFilter, setEventsFilter] = useState('');
  const { getValues, setValue, register, handleSubmit } = useForm({ defaultValues: { query: '' } }); //  form for search field

  const onFilterCleared = useCallback(() => {
    setEventsFilter('');
    setValue('query', '');
  }, [setEventsFilter, setValue]);

  // We prefer log count-based limit rather than time-based, but the API doesn't support it yet
  const queryTimeRange = useMemo(() => getDefaultTimeRange(), []);

  const {
    currentData: stateHistory,
    isLoading,
    isError,
    error,
  } = useGetRuleHistoryQuery(
    {
      from: queryTimeRange.from.unix(),
      to: queryTimeRange.to.unix(),
      limit: 250,
    },
    {
      refetchOnFocus: true,
      refetchOnReconnect: true,
      pollingInterval: STATE_HISTORY_POLLING_INTERVAL,
    }
  );
  const { historyRecords, findCommonLabels } = useRuleHistoryRecords(
    stateHistory
    // instancesFilter
  );
  const defaultPageNav: NavModelItem = {
    id: 'alerts-history',
    text: '',
  };

  if (isError) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alerts-history">
        <HistoryErrorMessage error={error} />
      </AlertingPageWrapper>
    );
  }

  if (isLoading) {
    return (
      <AlertingPageWrapper pageNav={defaultPageNav} navId="alerts-history" isLoading={true}>
        <></>
      </AlertingPageWrapper>
    );
  }

  return (
    <AlertingPageWrapper navId="alerts-history" isLoading={false}>
      <Stack direction="column" gap={1}>
        <form onSubmit={handleSubmit((data) => setEventsFilter(data.query))}>
          <SearchFieldInput
            {...register('query')}
            showClearFilterSuffix={!!eventsFilter}
            onClearFilterClick={onFilterCleared}
          />
          <input type="submit" hidden />
        </form>
        <HistoryLogEntry logRecords={historyRecords} />
      </Stack>
    </AlertingPageWrapper>
  );
};

interface HistoryLogEntryProps {
  logRecords: LogRecord[];
}
function HistoryLogEntry({ logRecords }: HistoryLogEntryProps) {
  // display log records
  return (
    <ul>
      {logRecords.map((record, index) => {
        return (
          <li key={index}>
            {record.timestamp} - {JSON.stringify(record.line.previous)} {`->`} {JSON.stringify(record.line.current)}-{' '}
            {JSON.stringify(record.line.labels)}
          </li>
        );
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
const SearchFieldInput = ({ showClearFilterSuffix, onClearFilterClick }: SearchFieldInputProps) => {
  return (
    <Field
      label={
        <Label htmlFor="instancesSearchInput">
          <Stack gap={0.5}>
            <span>Filter instances</span>
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
        placeholder="Filter events"
      />
    </Field>
  );
};

export default withErrorBoundary(CentralAlertHistory, { style: 'page' });
