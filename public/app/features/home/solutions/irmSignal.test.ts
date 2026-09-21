import { type BackendSrv, getBackendSrv } from '@grafana/runtime';

import { detectIrmSignal, resetIrmSignal } from './irmSignal';
import { PROBE_TIMEOUT_MS } from './probeUtils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

const get = jest.fn();

const integration = {
  value: 'abc',
  display_name: 'Grafana Alerting',
  integration_url: 'https://oncall/integrations/abc',
};

beforeEach(() => {
  resetIrmSignal();
  get.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as BackendSrv);
});

afterEach(() => {
  jest.useRealTimers();
});

it('asks the IRM plugin for Grafana Alerting integrations without toasting', async () => {
  get.mockResolvedValue({ results: [integration] });

  await expect(detectIrmSignal()).resolves.toBe('active');
  expect(get).toHaveBeenCalledWith(
    '/api/plugins/grafana-irm-app/resources/alert_receive_channels/',
    { filters: true, integration: ['grafana_alerting', 'legacy_grafana_alerting'], skip_pagination: true },
    undefined,
    { showErrorAlert: false, abortSignal: expect.any(AbortSignal) }
  );
});

it('reads a bare integration list as active', async () => {
  get.mockResolvedValue([integration]);

  await expect(detectIrmSignal()).resolves.toBe('active');
});

it.each([
  ['a paginated empty list', { results: [] }],
  ['a bare empty list', []],
])('reads %s as inactive', async (_desc, response) => {
  get.mockResolvedValue(response);

  await expect(detectIrmSignal()).resolves.toBe('inactive');
});

it('reads a missing plugin route (404) as inactive', async () => {
  get.mockRejectedValue({ status: 404, data: { message: 'Plugin not found' } });

  await expect(detectIrmSignal()).resolves.toBe('inactive');
});

it('reads a failing IRM backend as unknown', async () => {
  get.mockRejectedValue({ status: 502, data: {} });

  await expect(detectIrmSignal()).resolves.toBe('unknown');
});

it('reads a hung request as unknown once the probe deadline passes', async () => {
  jest.useFakeTimers();
  get.mockImplementation(() => new Promise(() => {}));

  const detected = detectIrmSignal();
  await jest.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS);

  await expect(detected).resolves.toBe('unknown');
});

it('shares one request between concurrent readers until reset', async () => {
  get.mockResolvedValue({ results: [integration] });

  await expect(Promise.all([detectIrmSignal(), detectIrmSignal()])).resolves.toEqual(['active', 'active']);
  expect(get).toHaveBeenCalledTimes(1);

  resetIrmSignal();
  await detectIrmSignal();
  expect(get).toHaveBeenCalledTimes(2);
});

it('retries after a failure instead of caching unknown', async () => {
  get.mockRejectedValueOnce({ status: 500, data: {} }).mockResolvedValueOnce({ results: [] });

  await expect(detectIrmSignal()).resolves.toBe('unknown');
  await expect(detectIrmSignal()).resolves.toBe('inactive');
  expect(get).toHaveBeenCalledTimes(2);
});
