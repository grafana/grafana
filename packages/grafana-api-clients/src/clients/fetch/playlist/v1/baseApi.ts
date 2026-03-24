import { getAPIBaseURL } from '../../../../utils/utils';

const API_GROUP = 'playlist.grafana.app';
const API_VERSION = 'v1';
const BASE_URL = getAPIBaseURL(API_GROUP, API_VERSION);

export const customFetch = async <T>(url: string, options: RequestInit): Promise<T> => {
  const response = await fetch(`${BASE_URL}${url}`, options);
  return response.json();
};
