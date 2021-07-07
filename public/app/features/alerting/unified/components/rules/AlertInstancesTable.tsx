import { GrafanaTheme2 } from '@grafana/data';
import { Alert } from 'app/types/unified-alerting';
import { css } from '@emotion/css';
import React, { FC, useMemo } from 'react';
import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';

interface Props {
  instances: Alert[];
}

type AlertTableColumnProps = DynamicTableColumnProps<Alert>;
type AlertTableItemProps = DynamicTableItemProps<Alert>;

export const AlertInstancesTable: FC<Props> = ({ instances }) => {
  // add key & sort instance. API returns instances in random order, different every time.
  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances
        .map((instance) => ({
          data: instance,
          id: alertInstanceKey(instance),
        }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [instances]
  );

  return (
    <DynamicTable
      cols={columns}
      isExpandable={true}
      items={items}
      renderExpandedContent={({ data }) => <AlertInstanceDetails instance={data} />}
    />
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  colExpand: css`
    width: 36px;
  `,
  colState: css`
    width: 110px;
  `,
  labelsCell: css`
    padding-top: ${theme.spacing(0.5)} !important;
    padding-bottom: ${theme.spacing(0.5)} !important;
  `,
  createdCell: css`
    white-space: nowrap;
  `,
  table: css`
    td {
      vertical-align: top;
      padding-top: ${theme.spacing(1)};
      padding-bottom: ${theme.spacing(1)};
    }
  `,
});

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
      <>{activeAt.startsWith('0001') ? '-' : activeAt.substr(0, 19).replace('T', ' ')}</>
    ),
    size: '150px',
  },
];
