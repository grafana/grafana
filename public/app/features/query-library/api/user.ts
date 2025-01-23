import { getBackendSrv } from '@grafana/runtime';

import { getK8sNamespace } from './query';
import { UserDataQueryResponse } from './types';

/**
 * @alpha
 */
export const API_VERSION = 'iam.grafana.app/v0alpha1';

/**
 * @alpha
 */
const BASE_URL = `apis/${API_VERSION}/namespaces/${getK8sNamespace()}/display`;

export async function getUserInfo(url?: string): Promise<UserDataQueryResponse> {
  const userInfo = await getBackendSrv().get(`${BASE_URL}${url}`);
  return userInfo;
}
