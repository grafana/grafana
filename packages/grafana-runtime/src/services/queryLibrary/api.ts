import { lastValueFrom } from 'rxjs';

import { DataQuerySpec, DataQuerySpecResponse, DataQueryTarget, QueryTemplate } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { FetchResponse, getBackendSrv } from '../backendSrv';

const BASE_URL = '/apis/peakq.grafana.app/v0alpha1/namespaces/default/querytemplates/';
const RENDER_URL = '/apis/peakq.grafana.app/v0alpha1/render';

/**
 * @alpha
 */
export async function fetchTemplates(): Promise<QueryTemplate[]> {
  const responseObservable = getBackendSrv().fetch<DataQuerySpecResponse>({
    url: BASE_URL,
  });
  const response = await lastValueFrom(responseObservable);
  const data = response.data;
  if (!data.items) {
    return [];
  }
  return data.items.map((spec) => {
    return {
      uid: spec.metadata.name || '',
      title: spec.spec.title,
      targets: spec.spec.targets.map((target) => target.properties),
      spec,
    };
  });
}

/**
 * @alpha
 */
export async function deleteTemplate(uid: string): Promise<void> {
  const responseObservable = getBackendSrv().fetch({
    method: 'DELETE',
    url: BASE_URL + uid,
  });
  await lastValueFrom(responseObservable);
}

/**
 * @alpha
 */
export async function renderQueryTemplate({
  spec,
  variables,
}: {
  spec: DataQuerySpec;
  variables: Record<string, string>;
}): Promise<DataQuery> {
  const varParams = Object.keys(variables)
    .map((key) => `var-${key}=${variables[key]}`)
    .join('&');

  const responseObservable = getBackendSrv().fetch<{ targets: DataQueryTarget[] }>({
    method: 'POST',
    url: RENDER_URL + '?' + varParams,
    data: spec.spec,
  });

  const response: FetchResponse<{ targets: DataQueryTarget[] }> = await lastValueFrom(responseObservable);
  console.log('Query Template rendered', response);

  return response.data.targets[0].properties;
}
