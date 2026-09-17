import { type DataSourceInstanceListItem, type PluginMeta } from '@grafana/data';
import { canAccessPluginPage, isPluginEnabled, probePlugin } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { constructDataSourceExploreUrl } from 'app/features/datasources/utils';

import { accessibleAppPage, drilldownActiveCta, isDrilldownAvailable } from './pluginPages';

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  canAccessPluginPage: jest.fn(),
  isPluginEnabled: jest.fn(),
  probePlugin: jest.fn(),
}));

jest.mock('app/features/datasources/utils', () => ({
  constructDataSourceExploreUrl: jest.fn(),
}));

const probePluginMock = jest.mocked(probePlugin);
const isPluginEnabledMock = jest.mocked(isPluginEnabled);
const canAccessPluginPageMock = jest.mocked(canAccessPluginPage);
const constructDataSourceExploreUrlMock = jest.mocked(constructDataSourceExploreUrl);

const datasource = {
  uid: 'prom-uid',
  name: 'Prometheus',
  type: 'prometheus',
} as DataSourceInstanceListItem;

function settings(id: string): PluginMeta<{}> {
  return { id, enabled: true } as PluginMeta<{}>;
}

beforeEach(() => {
  probePluginMock.mockReset();
  isPluginEnabledMock.mockReset();
  canAccessPluginPageMock.mockReset();
  constructDataSourceExploreUrlMock.mockReset();
  isPluginEnabledMock.mockReturnValue(true);
  canAccessPluginPageMock.mockReturnValue(true);
  constructDataSourceExploreUrlMock.mockReturnValue('/explore?left=prometheus');
});

it('checks access against the exact deep page the CTA will open', async () => {
  const appSettings = settings('deep-page-app');
  probePluginMock.mockResolvedValue({ settings: appSettings });
  const path = '/a/deep-page-app/explore?var-ds=prom-uid';

  await expect(isDrilldownAvailable('deep-page-app', path)).resolves.toBe(true);
  expect(canAccessPluginPageMock).toHaveBeenCalledWith(appSettings, path);
});

it('also requires access to the default page when it carries the app-wide permission', async () => {
  const appSettings = {
    ...settings('root-gated-app'),
    includes: [{ defaultNav: true, path: '/a/root-gated-app/' }],
  } as PluginMeta<{}>;
  probePluginMock.mockResolvedValue({ settings: appSettings });
  canAccessPluginPageMock.mockImplementation((_settings, path) => path !== '/a/root-gated-app/');

  await expect(isDrilldownAvailable('root-gated-app', '/a/root-gated-app/explore?var-ds=prom-uid')).resolves.toBe(
    false
  );
  expect(canAccessPluginPageMock).toHaveBeenCalledWith(appSettings, '/a/root-gated-app/');
});

it('opens an accessible drilldown page', async () => {
  probePluginMock.mockResolvedValue({ settings: settings('accessible-app') });
  const path = '/a/accessible-app/explore?var-ds=prom-uid';

  await expect(drilldownActiveCta(datasource, 'accessible-app', 'Metrics Drilldown', path)).resolves.toEqual({
    label: 'Open Metrics Drilldown',
    href: path,
    action: 'open_solution',
  });
});

it('falls back to Explore with the proving datasource when the deep page is inaccessible', async () => {
  probePluginMock.mockResolvedValue({ settings: settings('inaccessible-app') });
  canAccessPluginPageMock.mockReturnValue(false);

  await expect(
    drilldownActiveCta(datasource, 'inaccessible-app', 'Metrics Drilldown', '/a/inaccessible-app/explore')
  ).resolves.toEqual({ label: 'Open in Explore', href: '/explore?left=prometheus', action: 'open_solution' });
  expect(constructDataSourceExploreUrlMock).toHaveBeenCalledWith({ name: 'Prometheus' });
});

it('returns a bridge path only when that app page is accessible', async () => {
  probePluginMock.mockResolvedValue({ settings: settings('bridge-app') });

  await expect(accessibleAppPage('bridge-app', '/alerts')).resolves.toBe('/a/bridge-app/alerts');

  probePluginMock.mockResolvedValue({ settings: settings('blocked-bridge-app') });
  canAccessPluginPageMock.mockReturnValue(false);
  await expect(accessibleAppPage('blocked-bridge-app', '/alerts')).resolves.toBeNull();
});

it('requires access to the default page before returning a deep bridge path', async () => {
  const appSettings = {
    ...settings('root-gated-app'),
    includes: [{ defaultNav: true, path: '/a/root-gated-app/home' }],
  } as PluginMeta<{}>;
  probePluginMock.mockResolvedValue({ settings: appSettings });
  canAccessPluginPageMock.mockImplementation((_settings, path) => path !== '/a/root-gated-app/home');

  await expect(accessibleAppPage('root-gated-app', '/alerts')).resolves.toBeNull();
  expect(canAccessPluginPageMock).toHaveBeenCalledWith(appSettings, '/a/root-gated-app/home');
});
