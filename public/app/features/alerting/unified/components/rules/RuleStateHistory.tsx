import React, { FC } from 'react';

import { dateTimeFormat, GrafanaTheme } from '@grafana/data';
import { LoadingPlaceholder, useStyles } from '@grafana/ui';
import { css } from '@emotion/css';
import { StateHistoryItem } from 'app/types/unified-alerting';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AlertStateTag } from './AlertStateTag';
import { useManagedAlertStateHistory } from '../../hooks/useManagedAlertStateHistory';
import { AlertLabel } from '../AlertLabel';

interface RuleStateHistoryProps {
  alertId: string;
}

type PartialHistoryItem = Pick<StateHistoryItem, 'newState' | 'updated' | 'data'>;

const RuleStateHistory: FC<RuleStateHistoryProps> = ({ alertId }) => {
  const { loading, error, result = [] } = useManagedAlertStateHistory(alertId);

  if (loading && !error) {
    return <LoadingPlaceholder text={'Loading history...'} />;
  }

  if (error && !loading) {
    return <div>{error.message}</div>;
  }

  const columns: Array<DynamicTableColumnProps<PartialHistoryItem>> = [
    {
      id: 'state',
      label: 'State',
      renderCell: renderStateCell,
    },
    {
      id: 'value',
      label: '',
      renderCell: renderValueCell,
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

function renderValueCell(item: DynamicTableItemProps<PartialHistoryItem>) {
  const matches = item.data.data?.evalMatches ?? [];

  return (
    <LabelsWrapper>
      {matches.map((match) => (
        <AlertLabel key={match.metric} labelKey={match.metric} value={String(match.value)} />
      ))}
    </LabelsWrapper>
  );
}

function renderStateCell(item: DynamicTableItemProps<PartialHistoryItem>) {
  return <AlertStateTag state={item.data.newState} />;
}

function renderTimestampCell(item: DynamicTableItemProps<PartialHistoryItem>) {
  return (
    <div className={TimestampStyle}>
      <span>{dateTimeFormat(item.data.updated)}</span>
    </div>
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

export { RuleStateHistory };
