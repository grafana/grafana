import { getAPIBaseURL } from '../../../../utils/utils';

const API_GROUP = 'advisor.grafana.app';
const API_VERSION = 'v0alpha1';
const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${url}`, options);
  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return { status: response.status, data, headers: response.headers } as T;
};
