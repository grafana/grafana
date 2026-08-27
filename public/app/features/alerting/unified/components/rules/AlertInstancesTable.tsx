import * as React from 'react';
import { useMemo } from 'react';

import { AlertLabels } from '@grafana/alerting/unstable';
import { dateTime } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type Alert, type CombinedRule, type PaginationProps } from 'app/types/unified-alerting';
import { PluginExtensionPoints } from '@grafana/data';
import { usePluginLinks } from '@grafana/runtime';

import { alertInstanceKey } from '../../utils/rules';
import { DynamicTable, type DynamicTableColumnProps, type DynamicTableItemProps } from '../DynamicTable';
import { AlertInstanceExtensionPoint } from '../extensions/AlertInstanceExtensionPoint';

import { AlertInstanceDetails } from './AlertInstanceDetails';
import { AlertInstanceNotificationAction } from './AlertInstanceNotificationAction';
import { AlertStateTag } from './AlertStateTag';

interface Props {
  rule?: CombinedRule;
  instances: Alert[];
  pagination?: PaginationProps;
  footerRow?: React.ReactNode;
  showNotificationColumn?: boolean;
}

interface RuleAndAlert {
  rule?: CombinedRule;
  alert: Alert;
}

type AlertTableColumnProps = DynamicTableColumnProps<RuleAndAlert>;
type AlertTableItemProps = DynamicTableItemProps<RuleAndAlert>;

export const AlertInstancesTable = ({ rule, instances, pagination, footerRow, showNotificationColumn }: Props) => {
  const items = useMemo(
    (): AlertTableItemProps[] =>
      instances.map((instance) => ({
        data: { rule, alert: instance },
        id: alertInstanceKey(instance),
      })),
    [instances, rule]
  );

  // Detect if any plugins have registered alert instance actions at all. If none are registered,
  // we avoid adding the plugin-actions column so the table doesn't reserve an empty 40px column.
  const { links: anyInstanceActionLinks } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.AlertInstanceAction,
    limitPerPlugin: 1,
  });

  const showPluginActionsColumn = anyInstanceActionLinks.length > 0;

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
    ...(showNotificationColumn
      ? [
          {
            id: 'actions',
            label: t('alerting.alert-instances-table.destination', 'Destination'),
            renderCell: ({ data: { alert, rule } }: AlertTableItemProps) => (
              <AlertInstanceNotificationAction rule={rule} instance={alert} />
            ),
            size: '120px',
          } satisfies AlertTableColumnProps,
        ]
      : []),
    // Only include the plugin actions column when there are registered plugins that can provide actions.
    ...(showPluginActionsColumn
      ? [
          {
            id: 'plugin-actions',
            label: '',
            // eslint-disable-next-line react/display-name
            renderCell: ({ data: { alert, rule } }: AlertTableItemProps) => (
              <AlertInstanceExtensionPoint rule={rule} instance={alert} />
            ),
            size: '40px',
          },
        ]
      : []),
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
