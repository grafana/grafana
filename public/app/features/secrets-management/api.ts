import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';

import { Secret, SecretsListResponse } from './types';
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
  );
}

export async function createSecretRequest(data: Partial<Secret> & { value?: string }) {
  return await lastValueFrom(
    getBackendSrv().fetch({
      method: 'POST',
      url: '/apis/secret.grafana.app/v0alpha1/namespaces/default/securevalues',
      data: transformFromSecret(data),
    })
  );
}
