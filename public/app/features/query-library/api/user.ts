import { getBackendSrv } from '@grafana/runtime';

import { getAPINamespace } from '../../../api/utils';

import { UserDataQueryResponse } from './types';

/**
 * @alpha
 */
export const API_VERSION = 'iam.grafana.app/v0alpha1';

/**
 * @alpha
 */
const BASE_URL = `apis/${API_VERSION}/namespaces/${getAPINamespace()}/display`;

export async function getUserInfo(url?: string): Promise<UserDataQueryResponse> {
  const userInfo = await getBackendSrv().get(`${BASE_URL}${url}`);
  return userInfo;
}
