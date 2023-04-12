import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';
import {
  ListServicesBody,
  RemoveServiceBody,
  Service,
  ServiceListPayload,
  ServiceStatus,
} from 'app/percona/shared/services/services/Services.types';

import { ListServicesParams, RemoveServiceParams } from './services.types';

export const MAIN_COLUMNS = [
  'service_id',
  'type',
  'service_name',
  'custom_labels',
  'node_id',
  'address',
  'port',
  'agents',
  'node_name',
  'status',
];

export const toRemoveServiceBody = (params: RemoveServiceParams): RemoveServiceBody => ({
  service_id: params.serviceId,
  force: params.force,
});

export const toListServicesBody = (params: Partial<ListServicesParams>): Partial<ListServicesBody> => ({
  node_id: params.nodeId,
  service_type: params.serviceType,
  external_group: params.externalGroup,
});

export const toDbServicesModel = (serviceList: ServiceListPayload): Service[] => {
  const result: Service[] = [];
  const { services = [] } = serviceList;

  services.forEach(({ service_type: serviceType, status, ...serviceParams }) => {
    const extraLabels: Record<string, string> = {};

    Object.entries(serviceParams)
      .filter(([field]) => !MAIN_COLUMNS.includes(field))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .forEach(([key, value]: [string, string | number | any[] | Record<string, string>]) => {
        if (typeof value !== 'object' || Array.isArray(value)) {
          extraLabels[key] = value.toString();
          // @ts-ignore
          delete serviceParams[key];
        }
      });

    const camelCaseParams = payloadToCamelCase(serviceParams, ['custom_labels']);
    // @ts-ignore
    delete camelCaseParams['custom_labels'];

    if (!status || status === 'STATUS_INVALID') {
      status = ServiceStatus.NA;
    }

    result.push({
      type: serviceType,
      // @ts-ignore
      params: {
        ...camelCaseParams,
        status,
        customLabels: { ...serviceParams['custom_labels'], ...extraLabels },
      },
    });
  });

  return result;
};
