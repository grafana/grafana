import { getAPIBaseURL } from '../../../../utils/utils';

const API_GROUP = 'correlations.grafana.app';
const API_VERSION = 'v0alpha1';
const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const customFetch = async (url: string, options: RequestInit) => {
  const response = await fetch(`${BASE_URL}${url}`, options);
  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
};
