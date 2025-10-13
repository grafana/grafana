import { ExtendedColumn, FilterFieldTypes } from 'app/percona/shared/components/Elements/Table';

import { Messages } from '../../Inventory.messages';
import { FlattenService } from '../../Inventory.types';

import { MONITORING_OPTIONS, STATUS_OPTIONS } from './Services.constants';

export const CLUSTERS_COLUMNS: Array<ExtendedColumn<FlattenService>> = [
  {
    Header: Messages.services.columns.serviceId,
    id: 'serviceId',
    accessor: 'serviceId',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.services.columns.cluster,
    accessor: 'cluster',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.services.columns.status,
    accessor: 'status',
    type: FilterFieldTypes.DROPDOWN,
    options: STATUS_OPTIONS,
  },
  {
    Header: Messages.services.columns.serviceName,
    accessor: 'serviceName',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.services.columns.nodeName,
    accessor: 'nodeName',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.services.columns.monitoring,
    accessor: 'agentsStatus',
    type: FilterFieldTypes.RADIO_BUTTON,
    options: MONITORING_OPTIONS,
  },
  {
    Header: Messages.services.columns.address,
    accessor: 'address',
    type: FilterFieldTypes.TEXT,
  },
  {
    Header: Messages.services.columns.port,
    accessor: 'port',
    type: FilterFieldTypes.TEXT,
  },
];
