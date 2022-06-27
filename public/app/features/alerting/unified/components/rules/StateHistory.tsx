import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { FC } from 'react';

import { AlertState, dateTimeFormat, GrafanaTheme } from '@grafana/data';
import { Alert, LoadingPlaceholder, useStyles } from '@grafana/ui';
import { StateHistoryItem, StateHistoryItemData } from 'app/types/unified-alerting';
import { GrafanaAlertStateWithReason, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { useManagedAlertStateHistory } from '../../hooks/useManagedAlertStateHistory';
import { AlertLabel } from '../AlertLabel';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

import { AlertStateTag } from './AlertStateTag';

type StateHistoryRowItem = {
  id: string;
  state: PromAlertingRuleState | GrafanaAlertStateWithReason | AlertState;
  text?: string;
  data?: StateHistoryItemData;
  timestamp?: number;
};

type StateHistoryRow = DynamicTableItemProps<StateHistoryRowItem>;

interface RuleStateHistoryProps {
  alertId: string;
}

const StateHistory: FC<RuleStateHistoryProps> = ({ alertId }) => {
  const { loading, error, result = [] } = useManagedAlertStateHistory(alertId);

  if (loading && !error) {
    return <LoadingPlaceholder text={'Loading history...'} />;
  }

  if (error && !loading) {
    return <Alert title={'Failed to fetch alert state history'}>{error.message}</Alert>;
  }

  const columns: Array<DynamicTableColumnProps<StateHistoryRowItem>> = [
    { id: 'state', label: 'State', size: 'max-content', renderCell: renderStateCell },
    { id: 'value', label: '', size: 'auto', renderCell: renderValueCell },
    { id: 'timestamp', label: 'Time', size: 'max-content', renderCell: renderTimestampCell },
  ];

  const items: StateHistoryRow[] = result
    .reduce((acc: StateHistoryRowItem[], item, index) => {
      acc.push({
        id: String(item.id),
        state: item.newState,
        text: item.text,
        data: item.data,
        timestamp: item.updated,
      });

      // if the preceding state is not the same, create a separate state entry – this likely means the state was reset
      if (!hasMatchingPrecedingState(index, result)) {
        acc.push({ id: uniqueId(), state: item.prevState });
      }

      return acc;
    }, [])
    .map((historyItem) => ({
      id: historyItem.id,
      data: historyItem,
    }));

  return <DynamicTable cols={columns} items={items} />;
};

function renderValueCell(item: StateHistoryRow) {
  const matches = item.data.data?.evalMatches ?? [];

  return (
    <>
      {item.data.text}
      <LabelsWrapper>
        {matches.map((match) => (
          <AlertLabel key={match.metric} labelKey={match.metric} value={String(match.value)} />
        ))}
      </LabelsWrapper>
    </>
  );
}

function renderStateCell(item: StateHistoryRow) {
  return <AlertStateTag state={item.data.state} />;
}

function renderTimestampCell(item: StateHistoryRow) {
  return (
    <div className={TimestampStyle}>{item.data.timestamp && <span>{dateTimeFormat(item.data.timestamp)}</span>}</div>
  );
}

const LabelsWrapper: FC<{}> = ({ children }) => {
  const { wrapper } = useStyles(getStyles);
  return <div className={wrapper}>{children}</div>;
};

const TimestampStyle = css`
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`;

const getStyles = (theme: GrafanaTheme) => ({
  wrapper: css`
    & > * {
      margin-right: ${theme.spacing.xs};
    }
  `,
});

// this function will figure out if a given historyItem has a preceding historyItem where the states match - in other words
// the newState of the previous historyItem is the same as the prevState of the current historyItem
function hasMatchingPrecedingState(index: number, items: StateHistoryItem[]): boolean {
  const currentHistoryItem = items[index];
  const previousHistoryItem = items[index + 1];

  if (!previousHistoryItem) {
    return false;
  }

  return previousHistoryItem.newState === currentHistoryItem.prevState;
}

export { StateHistory };
