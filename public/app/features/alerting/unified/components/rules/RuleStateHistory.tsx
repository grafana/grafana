import React, { FC } from 'react';

import { dateTimeFormat } from '@grafana/data';
import { StringLike } from '@visx/scale';
import { StateHistoryItem } from 'app/types/unified-alerting';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AlertStateTag } from './AlertStateTag';

interface RuleStateHistoryProps {
  alertId: StringLike;
}

type PartialHistoryItem = Pick<StateHistoryItem, 'newState' | 'updated'>;

const RuleStateHistory: FC<RuleStateHistoryProps> = ({ alertId }) => {
  const columns: Array<DynamicTableColumnProps<PartialHistoryItem>> = [
    // eslint-disable-next-line react/display-name
    { id: 'state', label: 'State', renderCell: ({ data: { newState } }) => <AlertStateTag state={newState} /> },
    { id: 'timestamp', label: 'Time', renderCell: ({ data: { updated } }) => dateTimeFormat(updated) },
  ];

  const items: Array<DynamicTableItemProps<PartialHistoryItem>> = [
    { id: '2', data: { newState: GrafanaAlertState.Alerting, updated: 1635757464865 } },
    { id: '1', data: { newState: GrafanaAlertState.Pending, updated: 1635757392876 } },
  ];

  return <DynamicTable cols={columns} isExpandable={false} items={items} />;
};

export { RuleStateHistory };
