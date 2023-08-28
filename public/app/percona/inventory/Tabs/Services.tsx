/* eslint-disable @typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row } from 'react-table';

import { locationService } from '@grafana/runtime';
import { Badge, Button, HorizontalGroup, Icon, Link, TagList, useStyles2 } from '@grafana/ui';
import { OldPage } from 'app/core/components/Page/Page';
import { stripServiceId } from 'app/percona/check/components/FailedChecksTab/FailedChecksTab.utils';
import { Action } from 'app/percona/dbaas/components/MultipleActions';
import { DetailsRow } from 'app/percona/shared/components/Elements/DetailsRow/DetailsRow';
import { FeatureLoader } from 'app/percona/shared/components/Elements/FeatureLoader';
import { ServiceIconWithText } from 'app/percona/shared/components/Elements/ServiceIconWithText/ServiceIconWithText';
import { ExtendedColumn, FilterFieldTypes, Table } from 'app/percona/shared/components/Elements/Table';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { fetchActiveServiceTypesAction, fetchServicesAction } from 'app/percona/shared/core/reducers/services';
import { getServices } from 'app/percona/shared/core/selectors';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { getDashboardLinkForService } from 'app/percona/shared/helpers/getDashboardLinkForService';
import { getExpandAndActionsCol } from 'app/percona/shared/helpers/getExpandAndActionsCol';
import { logger } from 'app/percona/shared/helpers/logger';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';
import { useAppDispatch } from 'app/store/store';
import { useSelector } from 'app/types';

import { GET_SERVICES_CANCEL_TOKEN } from '../Inventory.constants';
import { Messages } from '../Inventory.messages';
import { FlattenService, MonitoringStatus } from '../Inventory.types';
import DeleteServiceModal from '../components/DeleteServiceModal';
import DeleteServicesModal from '../components/DeleteServicesModal';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import { StatusInfo } from '../components/StatusInfo/StatusInfo';
import { StatusLink } from '../components/StatusLink/StatusLink';

import {
  getBadgeColorForServiceStatus,
  getBadgeIconForServiceStatus,
  getBadgeTextForServiceStatus,
  getAgentsMonitoringStatus,
  getNodeLink,
} from './Services.utils';
import { getStyles } from './Tabs.styles';

export const Services = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selected, setSelectedRows] = useState<Array<Row<FlattenService>>>([]);
  const [actionItem, setActionItem] = useState<FlattenService | null>(null);
  const navModel = usePerconaNavModel('inventory-services');
  const [generateToken] = useCancelToken();
  const dispatch = useAppDispatch();
  const { isLoading, services: fetchedServices } = useSelector(getServices);
  const styles = useStyles2(getStyles);
  const flattenServices = useMemo(
    () =>
      fetchedServices.map((value) => {
        return {
          type: value.type,
          ...value.params,
          agentsStatus: getAgentsMonitoringStatus(value.params.agents ?? []),
        };
      }),
    [fetchedServices]
  );

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
          setActionItem(row.original);
          setModalVisible(true);
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
    [styles.actionItemTxtSpan]
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
          <StatusLink type="services" strippedId={stripServiceId(row.original.serviceId)} agentsStatus={value} />
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

  const loadData = useCallback(async () => {
    try {
      await dispatch(fetchServicesAction({ token: generateToken(GET_SERVICES_CANCEL_TOKEN) }));
      await dispatch(fetchActiveServiceTypesAction());
    } catch (e) {
      if (isApiCancelError(e)) {
        return;
      }
      logger.error(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAddService = useCallback(() => {
    locationService.push('/add-instance');
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectionChange = useCallback((rows: Array<Row<FlattenService>>) => {
    setSelectedRows(rows);
  }, []);

  const renderSelectedSubRow = React.useCallback(
    (row: Row<FlattenService>) => {
      const labels = row.original.customLabels || {};
      const labelKeys = Object.keys(labels);
      const agents = row.original.agents || [];

      return (
        <DetailsRow>
          {!!agents.length && (
            <DetailsRow.Contents title={Messages.services.details.agents}>
              <StatusBadge
                strippedId={stripServiceId(row.original.serviceId)}
                type={'services'}
                agents={row.original.agents || []}
              />
            </DetailsRow.Contents>
          )}
          <DetailsRow.Contents title={Messages.services.details.serviceId}>
            <span>{row.original.serviceId}</span>
          </DetailsRow.Contents>
          {!!labelKeys.length && (
            <DetailsRow.Contents title={Messages.services.details.labels} fullRow>
              <TagList
                colorIndex={9}
                className={styles.tagList}
                tags={labelKeys.map((label) => `${label}=${labels![label]}`)}
              />
            </DetailsRow.Contents>
          )}
        </DetailsRow>
      );
    },
    [styles.tagList]
  );

  const onModalClose = useCallback(() => {
    setModalVisible(false);
    setActionItem(null);
  }, []);

  const onDeleteSuccess = useCallback(() => {
    setSelectedRows([]);
    onModalClose();
    loadData();
  }, [onModalClose, loadData]);

  return (
    <OldPage navModel={navModel}>
      <OldPage.Contents>
        <FeatureLoader>
          <HorizontalGroup height={40} justify="flex-end" align="flex-start">
            <Button
              size="md"
              disabled={selected.length === 0}
              onClick={() => {
                setModalVisible(true);
              }}
              icon="trash-alt"
              variant="destructive"
            >
              {Messages.delete}
            </Button>
            <Button icon="plus" onClick={onAddService}>
              {Messages.services.add}
            </Button>
          </HorizontalGroup>
          {actionItem ? (
            <DeleteServiceModal
              serviceId={actionItem.serviceId}
              serviceName={actionItem.serviceName}
              isOpen={modalVisible}
              onCancel={onModalClose}
              onSuccess={onDeleteSuccess}
            />
          ) : (
            <DeleteServicesModal
              services={selected}
              isOpen={modalVisible}
              onSuccess={onDeleteSuccess}
              onDismiss={onModalClose}
            />
          )}
          <Table
            columns={columns}
            data={flattenServices}
            totalItems={flattenServices.length}
            rowSelection
            onRowSelection={handleSelectionChange}
            showPagination
            pageSize={25}
            allRowsSelectionMode="page"
            emptyMessage={Messages.services.emptyTable}
            pendingRequest={isLoading}
            overlayClassName={styles.overlay}
            renderExpandedRow={renderSelectedSubRow}
            autoResetSelectedRows={false}
            getRowId={useCallback((row: FlattenService) => row.serviceId, [])}
            showFilter
          />
        </FeatureLoader>
      </OldPage.Contents>
    </OldPage>
  );
};

export default Services;
