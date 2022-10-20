import { ListServicesBody, RemoveServiceBody } from 'app/percona/shared/services/services/Services.types';

import { ListServicesParams, RemoveServiceParams } from './services.types';

export const toRemoveServiceBody = (params: RemoveServiceParams): RemoveServiceBody => ({
  service_id: params.serviceId,
  force: params.force,
});

export const toListServicesBody = (params: Partial<ListServicesParams>): Partial<ListServicesBody> => ({
  node_id: params.nodeId,
  service_type: params.serviceType,
  external_group: params.externalGroup,
});
