import { HttpResponse, http } from 'msw';

import { setupMswServer } from '../mockApi';
import { setRulesAPIGroupVersions } from '../mocks/server/configure';
import { captureRequests } from '../mocks/server/events';

import { resetRulesAPIVersion, resolveRulesAPIVersion } from './rulesApiVersion';

const server = setupMswServer();

const RULES_API_GROUP_URL = '/apis/rules.alerting.grafana.app/';

describe('resolveRulesAPIVersion', () => {
  beforeEach(() => {
    resetRulesAPIVersion();
  });

  afterEach(() => {
    server.events.removeAllListeners('request:start');
  });

  it('resolves to v1beta1 when the server serves v1beta1 and v0alpha1', async () => {
    setRulesAPIGroupVersions(['v1beta1', 'v0alpha1']);

    expect(await resolveRulesAPIVersion()).toBe('v1beta1');
  });

  it('falls back to v0alpha1 when the server only serves v0alpha1', async () => {
    setRulesAPIGroupVersions(['v0alpha1']);

    expect(await resolveRulesAPIVersion()).toBe('v0alpha1');
  });

  it('asks the server once and reuses the answer for later calls', async () => {
    setRulesAPIGroupVersions(['v0alpha1']);
    const discoveryRequests = captureRequests((req) => new URL(req.url).pathname === RULES_API_GROUP_URL);

    expect(await resolveRulesAPIVersion()).toBe('v0alpha1');
    expect(await resolveRulesAPIVersion()).toBe('v0alpha1');

    expect(await discoveryRequests).toHaveLength(1);
  });

  it('falls back to v0alpha1 when discovery fails, and asks again on the next call', async () => {
    server.use(http.get(RULES_API_GROUP_URL, () => HttpResponse.json({ message: 'unavailable' }, { status: 503 })));

    expect(await resolveRulesAPIVersion()).toBe('v0alpha1');

    setRulesAPIGroupVersions(['v1beta1', 'v0alpha1']);

    expect(await resolveRulesAPIVersion()).toBe('v1beta1');
  });
});
