import * as React from 'react';
import { useMemo } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { PluginExtensionPoints, dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Alert, CombinedRule, PaginationProps } from 'app/types/unified-alerting';

import { alertInstanceKey } from '../../utils/rules';
import { DynamicTable, DynamicTableColumnProps, DynamicTableItemProps } from '../DynamicTable';
import { AlertInstanceExtensionPoint } from '../extensions/AlertInstanceExtensionPoint';

import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertStateTag } from './AlertStateTag';

interface Props {
  rule?: CombinedRule;
  instances: Alert[];
  pagination?: PaginationProps;
  footerRow?: React.ReactNode;
}

interface RuleAndAlert {
  rule?: CombinedRule;
  alert: Alert;
}

type AlertTableColumnProps = DynamicTableColumnProps<RuleAndAlert>;
type AlertTableItemProps = DynamicTableItemProps<RuleAndAlert>;

export const AlertInstancesTable = ({ rule, instances, pagination, footerRow }: Props) => {
  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances.map((instance) => ({
        data: { rule, alert: instance },
        id: alertInstanceKey(instance),
      })),
    [instances, rule]
  );

  const columns: AlertTableColumnProps[] = [
    {
      id: 'state',
      label: t('alerting.alert-instances-table.state', 'State'),
      // eslint-disable-next-line react/display-name
      renderCell: ({
        data: {
          alert: { state },
        },
      }) => <AlertStateTag state={state} />,
      size: '95px',
    },
    {
      id: 'labels',
      label: t('alerting.alert-instances-table.labels', 'Labels'),
      // eslint-disable-next-line react/display-name
      renderCell: ({
        data: {
          alert: { labels },
        },
      }) => <AlertLabels labels={labels} labelSets={instances.map((i) => i.labels)} displayCommonLabels size="sm" />,
    },
    {
      id: 'created',
      label: t('alerting.alert-instances-table.created', 'Created'),
      // eslint-disable-next-line react/display-name
      renderCell: ({
        data: {
          alert: { activeAt },
        },
      }) => <>{activeAt.startsWith('0001') ? '-' : dateTime(activeAt).format('YYYY-MM-DD HH:mm:ss')}</>,
      size: '150px',
    },
    {
      id: 'actions',
      label: '',
      renderCell: ({ data: { alert, rule } }) => (
        <AlertInstanceExtensionPoint
          rule={rule}
          instance={alert}
          extensionPointId={PluginExtensionPoints.AlertInstanceAction}
          key="alert-instance-extension-point"
        />
      ),
      size: '40px',
    },
  ];

  return (
    <DynamicTable
      cols={columns}
      isExpandable={true}
      items={items}
      renderExpandedContent={({ data }) => <AlertInstanceDetails instance={data.alert} />}
      pagination={pagination}
      footerRow={footerRow}
    />
  );
};
