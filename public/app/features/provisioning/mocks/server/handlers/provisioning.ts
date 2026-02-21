import { HttpResponse, http } from 'msw';

import { PROVISIONING_API_BASE as BASE } from '../constants';

// --- Default response data ---

const defaultSettings = {
  items: [],
  allowImageRendering: true,
  availableRepositoryTypes: ['github', 'gitlab', 'bitbucket', 'git', 'local'],
};

const defaultStats = {
  instance: [],
};

const defaultRepositoryList = {
  items: [
    {
      metadata: { name: 'test-repo', generation: 1 },
      status: {
        observedGeneration: 1,
        health: {
          healthy: true,
          checked: Date.now(),
          message: [],
        },
      },
    },
  ],
};

const defaultRefs = {
  items: [{ name: 'main' }, { name: 'develop' }],
};

const defaultRepositoryFiles = {
  items: [],
};

const defaultConnection = {
  metadata: { name: 'test-conn' },
  spec: { type: 'github', title: 'Test Connection' },
  status: {
    health: { healthy: true },
    observedGeneration: 1,
    conditions: [
      {
        type: 'Ready',
        status: 'True',
        reason: 'Available',
        message: 'Connection is available',
        lastTransitionTime: new Date().toISOString(),
        observedGeneration: 1,
      },
    ],
  },
};

const defaultRepository = {
  metadata: { name: 'test-repo-abc123' },
  spec: { type: 'github', title: 'Test Repository' },
};

const defaultFileResponse = {
  resource: { upsert: {} },
};

// --- Handler factories ---

export const settingsHandler = (response = defaultSettings) =>
  http.get(`${BASE}/settings`, () => HttpResponse.json(response));

export const statsHandler = (response = defaultStats) => http.get(`${BASE}/stats`, () => HttpResponse.json(response));

export const listRepositoriesHandler = (response = defaultRepositoryList) =>
  http.get(`${BASE}/repositories`, () => HttpResponse.json(response));

export const getRepositoryRefsHandler = (response = defaultRefs) =>
  http.get(`${BASE}/repositories/:name/refs`, () => HttpResponse.json(response));

export const getRepositoryFilesHandler = (response = defaultRepositoryFiles) =>
  http.get(`${BASE}/repositories/:name/files/`, () => HttpResponse.json(response));

export const createRepositoryHandler = (response = defaultRepository) =>
  http.post(`${BASE}/repositories`, () => HttpResponse.json(response));

export const replaceRepositoryHandler = (response = defaultRepository) =>
  http.put(`${BASE}/repositories/:name`, () => HttpResponse.json(response));

export const testRepositoryHandler = () =>
  http.post(`${BASE}/repositories/:name/test`, () => HttpResponse.json({ success: true }));

export const createRepositoryJobsHandler = () =>
  http.post(`${BASE}/repositories/:name/jobs`, () =>
    HttpResponse.json({ spec: { action: 'pull' }, status: { state: 'success' } })
  );

export const createConnectionHandler = (response = defaultConnection) =>
  http.post(`${BASE}/connections`, () => HttpResponse.json(response));

export const replaceConnectionHandler = (response = defaultConnection) =>
  http.put(`${BASE}/connections/:name`, () => HttpResponse.json(response));

export const listConnectionsHandler = () => http.get(`${BASE}/connections`, () => HttpResponse.json({ items: [] }));

export const getConnectionRepositoriesHandler = () =>
  http.get(`${BASE}/connections/:name/repositories`, () => HttpResponse.json({ items: [] }));

export const createRepositoryFileHandler = (response = defaultFileResponse) =>
  http.post(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(response));

export const replaceRepositoryFileHandler = (response = defaultFileResponse) =>
  http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(response));

export const getRepositoryResourcesHandler = () =>
  http.get(`${BASE}/repositories/:name/resources`, () => HttpResponse.json({ items: [] }));

// --- Combined default handlers ---

const handlers = [
  settingsHandler(),
  statsHandler(),
  listRepositoriesHandler(),
  getRepositoryRefsHandler(),
  getRepositoryFilesHandler(),
  createRepositoryHandler(),
  replaceRepositoryHandler(),
  testRepositoryHandler(),
  createRepositoryJobsHandler(),
  createConnectionHandler(),
  replaceConnectionHandler(),
  listConnectionsHandler(),
  getConnectionRepositoriesHandler(),
  createRepositoryFileHandler(),
  replaceRepositoryFileHandler(),
  getRepositoryResourcesHandler(),
];

export default handlers;
