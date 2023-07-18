import React, { useMemo } from 'react';

import { dateTime, findCommonLabels } from '@grafana/data';
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

interface AlertWithCommonLabels extends Alert {
  commonLabels?: Record<string, string>;
}

type AlertTableColumnProps = DynamicTableColumnProps<AlertWithCommonLabels>;
type AlertTableItemProps = DynamicTableItemProps<AlertWithCommonLabels>;

export const AlertInstancesTable = ({ instances, pagination, footerRow }: Props) => {
  const commonLabels = useMemo(() => {
    // only compute the common labels if we have more than 1 instance, if we don't then that single instance
    // will have the complete set of common labels and no unique ones
    return instances.length > 1 ? findCommonLabels(instances.map((instance) => instance.labels)) : {};
  }, [instances]);

  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances.map((instance) => ({
        data: { ...instance, commonLabels },
        id: alertInstanceKey(instance),
      })),
    [commonLabels, instances]
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
    renderCell: ({ data: { labels, commonLabels } }) => (
      <AlertLabels labels={labels} commonLabels={commonLabels} size="sm" />
    ),
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
