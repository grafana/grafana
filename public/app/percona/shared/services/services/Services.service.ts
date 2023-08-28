import { CancelToken } from 'axios';

import { api } from 'app/percona/shared/helpers/api';

import {
  AddCustomLabelsBody,
  ListServicesBody,
  ListTypesPayload,
  RemoveCustomLabelsBody,
  RemoveServiceBody,
  ServiceListPayload,
  UpdateServiceBody,
} from './Services.types';

export const ServicesService = {
  getActive(token?: CancelToken, disableNotifications?: boolean) {
    return api.post<ListTypesPayload, {}>('/v1/inventory/Services/ListTypes', {}, disableNotifications, token);
  },
  getServices(body: Partial<ListServicesBody> = {}, token?: CancelToken) {
    return api.post<ServiceListPayload, Partial<ListServicesBody>>('/v1/management/Service/List', body, false, token);
  },
  removeService(body: RemoveServiceBody, token?: CancelToken) {
    return api.post<{}, RemoveServiceBody>('/v1/inventory/Services/Remove', body, false, token);
  },
  updateService(body: UpdateServiceBody, token?: CancelToken) {
    return api.post<{}, UpdateServiceBody>('/v1/inventory/Services/Change', body, false, token);
  },
  addCustomLabels(body: AddCustomLabelsBody, token?: CancelToken) {
    return api.post<{}, UpdateServiceBody>('/v1/inventory/Services/CustomLabels/Add', body, false, token);
  },
  removeCustomLabels(body: RemoveCustomLabelsBody, token?: CancelToken) {
    return api.post<{}, UpdateServiceBody>('/v1/inventory/Services/CustomLabels/Remove', body, false, token);
  },
};
