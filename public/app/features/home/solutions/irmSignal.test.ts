import { type BackendSrv, getBackendSrv } from '@grafana/runtime';

import { detectIrmSignal } from './irmSignal';

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
  get.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ get } as unknown as BackendSrv);
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
