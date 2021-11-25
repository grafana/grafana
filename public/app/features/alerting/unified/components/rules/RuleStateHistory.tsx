import React, { FC } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { css } from '@emotion/css';
import { StateHistoryItem } from 'app/types/unified-alerting';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AlertStateTag } from './AlertStateTag';
import { useManagedAlertStateHistory } from '../../hooks/useManagedAlertStateHistory';
import { LoadingPlaceholder } from '@grafana/ui';
import { LegacyAlertStateToGrafanaAlertState } from '../../utils/rules';

interface RuleStateHistoryProps {
  alertId: string;
}

type PartialHistoryItem = Pick<StateHistoryItem, 'newState' | 'updated' | 'data'>;

const RuleStateHistory: FC<RuleStateHistoryProps> = ({ alertId }) => {
  const { loading, error, result = [] } = useManagedAlertStateHistory(alertId);

  // TODO use LoadingIndicator
  if (loading && !error) {
    return <LoadingPlaceholder text={'Loading'} />;
  }

  if (error && !loading) {
    return <div>{error.toString()}</div>;
  }

  const columns: Array<DynamicTableColumnProps<PartialHistoryItem>> = [
    {
      id: 'state',
      label: 'State',
      renderCell: renderStateCell,
    },
    { id: 'timestamp', label: 'Time', renderCell: renderTimestampCell },
  ];

  const items: Array<DynamicTableItemProps<PartialHistoryItem>> = result.map((historyItem) => ({
    id: historyItem.id,
    data: {
      newState: historyItem.newState,
      updated: historyItem.updated,
      data: historyItem.data,
    },
  }));

  return <DynamicTable cols={columns} items={items} />;
};

function renderStateCell(item: DynamicTableItemProps<PartialHistoryItem>) {
  const matches = item.data.data?.evalMatches ?? [];
  // TODO convert this AlertState to GrafanaAlertState
  const newState = item.data.newState;

  return (
    <>
      <AlertStateTag state={LegacyAlertStateToGrafanaAlertState(newState)} />
      <div>{matches.map((match) => match.metric + '=' + match.value).join(', ')}</div>
    </>
  );
}

function renderTimestampCell(item: DynamicTableItemProps<PartialHistoryItem>) {
  return (
    <div className={TimestampStyle}>
      <span>{dateTimeFormat(item.data.updated)}</span>
    </div>
  );
}

const TimestampStyle = css`
  display: flex;
  align-items: flex-end;
  flex-direction: column;
`;

export { RuleStateHistory };
