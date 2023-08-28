import { payloadToCamelCase } from 'app/percona/shared/helpers/payloadToCamelCase';
import {
  AddCustomLabelsBody,
  ListServicesBody,
  RemoveCustomLabelsBody,
  RemoveServiceBody,
  Service,
  ServiceListPayload,
  ServiceStatus,
  UpdateServiceBody,
} from 'app/percona/shared/services/services/Services.types';

import { ListServicesParams, RemoveServiceParams, UpdateServiceParams } from './services.types';

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

export const toLabelValue = (original?: string, current?: string): string | undefined => {
  if (original === current) {
    return undefined;
  }

  // to clear a value set it's value to an empty string
  if (original !== undefined && current === undefined) {
    return '';
  }

  return current;
};

export const toUpdateServiceBody = ({ serviceId, labels, current }: UpdateServiceParams): UpdateServiceBody => ({
  service_id: serviceId,
  environment: toLabelValue(current.enviroment, labels.environment),
  cluster: toLabelValue(current.cluster, labels.cluster),
  replication_set: toLabelValue(current.replication_set, labels.replication_set),
});

export const toCustomLabelsBodies = (params: UpdateServiceParams): [AddCustomLabelsBody, RemoveCustomLabelsBody] => {
  const original = params.current.custom_labels;

  if (!original) {
    return [
      {
        service_id: params.serviceId,
        custom_labels: params.custom_labels,
      },
      {
        service_id: params.serviceId,
        custom_label_keys: [],
      },
    ];
  }

  const toAddOrUpdate: Record<string, string> = {};
  const toRemove: string[] = [];

  for (const label of Object.keys({
    ...original,
    ...params.custom_labels,
  })) {
    if (original[label] !== undefined && params.custom_labels[label] === undefined) {
      toRemove.push(label);
    } else if (original[label] === undefined && params.custom_labels[label] !== undefined) {
      toAddOrUpdate[label] = params.custom_labels[label];
    } else if (original[label] !== params.custom_labels[label]) {
      toAddOrUpdate[label] = params.custom_labels[label];
    }
  }

  return [
    {
      service_id: params.serviceId,
      custom_labels: toAddOrUpdate,
    },
    {
      service_id: params.serviceId,
      custom_label_keys: toRemove,
    },
  ];
};

export const didStandardLabelsChange = ({ current, labels }: UpdateServiceParams): boolean =>
  current.enviroment !== labels.environment ||
  current.cluster !== labels.cluster ||
  current.replication_set !== labels.replication_set;

export const hasLabelsToAddOrUpdate = (body: AddCustomLabelsBody): boolean => !!Object.keys(body.custom_labels).length;

export const hasLabelsToRemove = (body: RemoveCustomLabelsBody): boolean => !!body.custom_label_keys.length;

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
