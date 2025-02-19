import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { NewSecret, Secret, SecretsListResponse, SecretsListResponseItem } from './types';
import { transformFromSecret, transformListResponse } from './utils';

export async function getSecretsList() {
  const response = await lastValueFrom(
    getBackendSrv().fetch<SecretsListResponse>({
      method: 'GET',
      url: '/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues',
    })
  );

  return transformListResponse(response.data);
}

export async function deleteSecretRequest(name: string) {
  const safeName = encodeURIComponent(name);

  return await lastValueFrom(
    getBackendSrv().fetch({
      method: 'DELETE',
      url: `/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues/${safeName}`,
    })
  )
    .then((response) => Promise.resolve(response))
    .catch((error: unknown) => {
      return Promise.reject(error);
    });
}

export async function createSecretRequest(data: NewSecret) {
  return await lastValueFrom(
    getBackendSrv().fetch<SecretsListResponseItem>({
      method: 'POST',
      url: '/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues',
      data: transformFromSecret(data),
    })
  );
}

export async function updateSecretRequest(data: Secret) {
  const safeName = encodeURIComponent(data.name);

  return await lastValueFrom(
    getBackendSrv().fetch<SecretsListResponseItem>({
      method: 'PUT',
      url: `/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues/${safeName}`,
      data: transformFromSecret(data),
    })
  );
}
