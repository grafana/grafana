import React, { useMemo } from 'react';

import { dateTime } from '@grafana/data';
import { Alert, PaginationProps } from 'app/types/unified-alerting';

import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';

interface Props {
  instances: Alert[];
  pagination?: PaginationProps;
  footerRow?: JSX.Element;
}

type AlertTableColumnProps = DynamicTableColumnProps<Alert>;
type AlertTableItemProps = DynamicTableItemProps<Alert>;

export const AlertInstancesTable = ({ instances, pagination, footerRow }: Props) => {
  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances.map((instance) => ({
        data: instance,
        id: alertInstanceKey(instance),
      })),
    [instances]
  );

  return (
    <DynamicTable
      cols={columns}
      isExpandable={true}
      items={items}
      renderExpandedContent={({ data }) => <AlertInstanceDetails instance={data} />}
      pagination={pagination}
      footerRow={footerRow}
    />
  );
};

const columns: AlertTableColumnProps[] = [
  {
    id: 'state',
    label: 'State',
    // eslint-disable-next-line react/display-name
    renderCell: ({ data: { state } }) => <AlertStateTag state={state} />,
    size: '80px',
  },
  {
    id: 'labels',
    label: 'Labels',
    // eslint-disable-next-line react/display-name
    renderCell: ({ data: { labels } }) => <AlertLabels labels={labels} />,
  },
  {
    id: 'created',
    label: 'Created',
    // eslint-disable-next-line react/display-name
    renderCell: ({ data: { activeAt } }) => (
      <>{activeAt.startsWith('0001') ? '-' : dateTime(activeAt).format('YYYY-MM-DD HH:mm:ss')}</>
    ),
    size: '150px',
  },
];
