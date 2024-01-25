import { ALL_LABEL, ALL_VALUE } from 'app/percona/shared/components/Elements/Table/Filter/Filter.constants';
import { ServiceStatus } from 'app/percona/shared/services/services/Services.types';

import { MonitoringStatus } from '../../Inventory.types';

export const ALL_OPTION = { value: ALL_VALUE, label: ALL_LABEL };

export const STATUS_OPTIONS = [
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
];

export const STATUS_OPTIONS_WITH_ALL = [ALL_OPTION, ...STATUS_OPTIONS];

export const MONITORING_OPTIONS = [
  {
    label: MonitoringStatus.OK,
    value: MonitoringStatus.OK,
  },
  {
    label: MonitoringStatus.FAILED,
    value: MonitoringStatus.FAILED,
  },
];

export const MONITORING_OPTIONS_WITH_ALL = [ALL_OPTION, ...MONITORING_OPTIONS];
