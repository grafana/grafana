import { HttpResponse, http } from 'msw';

import server from '@grafana/test-utils/server';

import { PROVISIONING_API_BASE as BASE } from './constants';

export const setSettingsResponse = (response: object) => {
  server.use(http.get(`${BASE}/settings`, () => HttpResponse.json(response)));
};

export const setResourceStatsResponse = (instance: object[]) => {
  server.use(http.get(`${BASE}/stats`, () => HttpResponse.json({ instance })));
};

export const setRepositoryFilesResponse = (name: string, items: object[]) => {
  server.use(http.get(`${BASE}/repositories/${name}/files/`, () => HttpResponse.json({ items })));
};

export const setRepositoryRefsResponse = (name: string, items: object[]) => {
  server.use(http.get(`${BASE}/repositories/${name}/refs`, () => HttpResponse.json({ items })));
};

export const setListRepositoriesResponse = (items: object[]) => {
  server.use(http.get(`${BASE}/repositories`, () => HttpResponse.json({ items })));
};

export const setCreateConnectionError = (status: number, body: object) => {
  server.use(http.post(`${BASE}/connections`, () => HttpResponse.json(body, { status })));
};

export const setReplaceConnectionError = (status: number, body: object) => {
  server.use(http.put(`${BASE}/connections/:name`, () => HttpResponse.json(body, { status })));
};

export const setTestRepositoryError = (status: number, body: object) => {
  server.use(http.post(`${BASE}/repositories/:name/test`, () => HttpResponse.json(body, { status })));
};

export const setCreateRepositoryFileError = (status: number, body: object) => {
  server.use(http.post(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(body, { status })));
};
