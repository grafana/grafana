import * as React from 'react';
import { useMemo } from 'react';

import { PluginExtensionPoints, dateTime, findCommonLabels } from '@grafana/data';
import { Alert, CombinedRule, PaginationProps } from 'app/types/unified-alerting';

import { alertInstanceKey } from '../../utils/rules';
import { AlertLabels } from '../AlertLabels';
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

interface AlertWithCommonLabels extends Alert {
  commonLabels?: Record<string, string>;
}

interface RuleAndAlert {
  rule?: CombinedRule;
  alert: AlertWithCommonLabels;
}

type AlertTableColumnProps = DynamicTableColumnProps<RuleAndAlert>;
type AlertTableItemProps = DynamicTableItemProps<RuleAndAlert>;

export const AlertInstancesTable = ({ rule, instances, pagination, footerRow }: Props) => {
  const commonLabels = useMemo(() => {
    // only compute the common labels if we have more than 1 instance, if we don't then that single instance
    // will have the complete set of common labels and no unique ones
    return instances.length > 1 ? findCommonLabels(instances.map((instance) => instance.labels)) : {};
  }, [instances]);

  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances.map((instance) => ({
        data: { rule, alert: { ...instance, commonLabels } },
        id: alertInstanceKey(instance),
      })),
    [commonLabels, instances, rule]
  );

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

const columns: AlertTableColumnProps[] = [
  {
    id: 'state',
    label: 'State',
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
    label: 'Labels',
    // eslint-disable-next-line react/display-name
    renderCell: ({
      data: {
        alert: { labels, commonLabels },
      },
    }) => <AlertLabels labels={labels} commonLabels={commonLabels} size="sm" />,
  },
  {
    id: 'created',
    label: 'Created',
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
