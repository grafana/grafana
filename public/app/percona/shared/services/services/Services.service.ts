import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import { ListServicesBody, ListTypesPayload, RemoveServiceBody, ServiceListPayload } from './Services.types';

export const ServicesService = {
  getActive(token?: CancelToken) {
    return api.post<ListTypesPayload, {}>('/v1/inventory/Services/ListTypes', {}, false, token);
  },
  getServices(body: Partial<ListServicesBody> = {}, token?: CancelToken) {
    return api.post<ServiceListPayload, Partial<ListServicesBody>>('/v1/management/Service/List', body, false, token);
  },
  removeService(body: RemoveServiceBody, token?: CancelToken) {
    return api.post<{}, RemoveServiceBody>('/v1/inventory/Services/Remove', body, false, token);
  },
};
