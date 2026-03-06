import { HttpResponse, http } from 'msw';

export const BASE = '/apis/provisioning.grafana.app/v0alpha1/namespaces/:namespace';

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
          checked: 1704067200000,
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
        lastTransitionTime: '2024-01-01T00:00:00Z',
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

const settingsHandler = (response = defaultSettings) => http.get(`${BASE}/settings`, () => HttpResponse.json(response));

const statsHandler = (response = defaultStats) => http.get(`${BASE}/stats`, () => HttpResponse.json(response));

const listRepositoriesHandler = (response = defaultRepositoryList) =>
  http.get(`${BASE}/repositories`, () => HttpResponse.json(response));

const getRepositoryRefsHandler = (response = defaultRefs) =>
  http.get(`${BASE}/repositories/:name/refs`, () => HttpResponse.json(response));

const getRepositoryFilesHandler = (response = defaultRepositoryFiles) =>
  http.get(`${BASE}/repositories/:name/files/`, () => HttpResponse.json(response));

const createRepositoryHandler = (response = defaultRepository) =>
  http.post(`${BASE}/repositories`, () => HttpResponse.json(response));

const replaceRepositoryHandler = (response = defaultRepository) =>
  http.put(`${BASE}/repositories/:name`, () => HttpResponse.json(response));

const testRepositoryHandler = () =>
  http.post(`${BASE}/repositories/:name/test`, () => HttpResponse.json({ success: true }));

const createRepositoryJobsHandler = () =>
  http.post(`${BASE}/repositories/:name/jobs`, () =>
    HttpResponse.json({ spec: { action: 'pull' }, status: { state: 'success' } })
  );

const createConnectionHandler = (response = defaultConnection) =>
  http.post(`${BASE}/connections`, () => HttpResponse.json(response));

const replaceConnectionHandler = (response = defaultConnection) =>
  http.put(`${BASE}/connections/:name`, () => HttpResponse.json(response));

const listConnectionsHandler = () => http.get(`${BASE}/connections`, () => HttpResponse.json({ items: [] }));

const getConnectionRepositoriesHandler = () =>
  http.get(`${BASE}/connections/:name/repositories`, () => HttpResponse.json({ items: [] }));

const createRepositoryFileHandler = (response = defaultFileResponse) =>
  http.post(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(response));

const replaceRepositoryFileHandler = (response = defaultFileResponse) =>
  http.put(`${BASE}/repositories/:name/files/*`, () => HttpResponse.json(response));

const getRepositoryResourcesHandler = () =>
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
