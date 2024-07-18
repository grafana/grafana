import React, { FC, useCallback, useMemo } from 'react';
import { Row } from 'react-table';

import { locationService } from '@grafana/runtime';
import { Badge, HorizontalGroup, Icon, Link, TagList, useStyles2 } from '@grafana/ui';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { Action } from 'app/percona/shared/components/Elements/MultipleActions';
import { ServiceIconWithText } from 'app/percona/shared/components/Elements/ServiceIconWithText/ServiceIconWithText';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { getDashboardLinkForService } from 'app/percona/shared/helpers/getDashboardLinkForService';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import { Messages } from '../../Inventory.messages';
import { FlattenService, MonitoringStatus } from '../../Inventory.types';
import { StatusBadge } from '../../components/StatusBadge/StatusBadge';
import { StatusInfo } from '../../components/StatusInfo/StatusInfo';
import { StatusLink } from '../../components/StatusLink/StatusLink';
import {
  getBadgeColorForServiceStatus,
  getBadgeTextForServiceStatus,
  getBadgeIconForServiceStatus,
  getNodeLink,
  getTagsFromLabels,
} from '../Services.utils';
import { getStyles } from '../Tabs.styles';

interface ServicesTableProps {
  isLoading: boolean;
  flattenServices: FlattenService[];
  onSelectionChange: (rows: Array<Row<FlattenService>>) => void;
  onDelete: (service: FlattenService) => void;
  showPagination?: boolean;
  tableKey?: string;
}

const ServicesTable: FC<ServicesTableProps> = ({
  isLoading,
  flattenServices,
  onSelectionChange,
  onDelete,
  tableKey,
  showPagination = true,
}) => {
  const styles = useStyles2(getStyles);

  const getActions = useCallback(
    (row: Row<FlattenService>): Action[] => [
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="trash-alt" />
            <span className={styles.actionItemTxtSpan}>{Messages.delete}</span>
          </HorizontalGroup>
        ),
        action: () => {
          onDelete(row.original);
        },
      },
      {
        content: (
          <HorizontalGroup spacing="sm">
            <Icon name="pen" />
            <span className={styles.actionItemTxtSpan}>{Messages.edit}</span>
          </HorizontalGroup>
        ),
        action: () => {
          const serviceId = row.original.serviceId.split('/').pop();
          locationService.push(`/edit-instance/${serviceId}`);
        },
      },
      {
        content: Messages.services.actions.dashboard,
        action: () => {
          locationService.push(getDashboardLinkForService(row.original.type, row.original.serviceName));
        },
      },
      {
        content: Messages.services.actions.qan,
        action: () => {
          locationService.push(`/d/pmm-qan/pmm-query-analytics?var-service_name=${row.original.serviceName}`);
        },
      },
    ],
    [styles.actionItemTxtSpan, onDelete]
  );

  const columns = useMemo(
    (): Array<ExtendedColumn<FlattenService>> => [
      {
        Header: Messages.services.columns.serviceId,
        id: 'serviceId',
        accessor: 'serviceId',
        hidden: true,
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.services.columns.status,
        accessor: 'status',
        Cell: ({ value }: { value: ServiceStatus }) => (
          <Badge
            text={getBadgeTextForServiceStatus(value)}
            color={getBadgeColorForServiceStatus(value)}
            icon={getBadgeIconForServiceStatus(value)}
          />
        ),
        tooltipInfo: <StatusInfo />,
        type: FilterFieldTypes.DROPDOWN,
        options: [
          {
            label: 'Up',
            value: ServiceStatus.UP,
          },
          {
            label: 'Down',
            value: ServiceStatus.DOWN,
          },
          {
            label: 'Unknown',
            value: ServiceStatus.UNKNOWN,
          },
          {
            label: 'N/A',
            value: ServiceStatus.NA,
          },
        ],
      },
      {
        Header: Messages.services.columns.serviceName,
        accessor: 'serviceName',
        Cell: ({ value, row }: { row: Row<FlattenService>; value: string }) => (
          <ServiceIconWithText text={value} dbType={row.original.type} />
        ),
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.services.columns.nodeName,
        accessor: 'nodeName',
        Cell: ({ value, row }: { row: Row<FlattenService>; value: string }) => (
          <Link className={styles.link} href={getNodeLink(row.original)}>
            {value}
          </Link>
        ),
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.services.columns.monitoring,
        accessor: 'agentsStatus',
        width: '70px',
        Cell: ({ value, row }) => (
          <StatusLink type="services" strippedId={row.original.serviceId} agentsStatus={value} />
        ),
        type: FilterFieldTypes.RADIO_BUTTON,
        options: [
          {
            label: MonitoringStatus.OK,
            value: MonitoringStatus.OK,
          },
          {
            label: MonitoringStatus.FAILED,
            value: MonitoringStatus.FAILED,
          },
        ],
      },
      {
        Header: Messages.services.columns.address,
        accessor: 'address',
        type: FilterFieldTypes.TEXT,
      },
      {
        Header: Messages.services.columns.port,
        accessor: 'port',
        width: '100px',
        type: FilterFieldTypes.TEXT,
      },
      getExpandAndActionsCol(getActions),
    ],
    [styles, getActions]
  );

  const renderSelectedSubRow = React.useCallback(
    (row: Row<FlattenService>) => {
      const labels = row.original.customLabels || {};
      const labelKeys = Object.keys(labels);
      const agents = row.original.agents || [];

      return (
        <DetailsRow>
          {!!agents.length && (
            <DetailsRow.Contents title={Messages.services.details.agents}>
              <StatusBadge strippedId={row.original.serviceId} type={'services'} agents={row.original.agents || []} />
            </DetailsRow.Contents>
          )}
          <DetailsRow.Contents title={Messages.services.details.serviceId}>
            <span>{row.original.serviceId}</span>
          </DetailsRow.Contents>
          {!!labelKeys.length && (
            <DetailsRow.Contents title={Messages.services.details.labels} fullRow>
              <TagList colorIndex={9} className={styles.tagList} tags={getTagsFromLabels(labelKeys, labels)} />
            </DetailsRow.Contents>
          )}
        </DetailsRow>
      );
    },
    [styles.tagList]
  );

  return (
    <Table
      columns={columns}
      data={flattenServices}
      totalItems={flattenServices.length}
      rowSelection
      onRowSelection={onSelectionChange}
      showPagination={showPagination}
      pageSize={25}
      allRowsSelectionMode="page"
      emptyMessage={Messages.services.emptyTable}
      pendingRequest={isLoading}
      overlayClassName={styles.overlay}
      renderExpandedRow={renderSelectedSubRow}
      autoResetSelectedRows={false}
      getRowId={useCallback((row: FlattenService) => row.serviceId, [])}
      showFilter
      tableKey={tableKey}
    />
  );
};

export default ServicesTable;
