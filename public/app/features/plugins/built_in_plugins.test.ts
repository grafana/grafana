import { setTestFlags } from '@grafana/test-utils/unstable';

import builtInPlugins from './built_in_plugins';

const mockLoadedVersions: string[] = [];

jest.mock('app/plugins/panel/stat/module', () => {
  mockLoadedVersions.push('v1');
  return { plugin: { version: 'v1' } };
});

jest.mock('app/plugins/panel/stat/v2/module', () => {
  mockLoadedVersions.push('v2');
  return { plugin: { version: 'v2' } };
});

afterEach(() => setTestFlags({}));

it('loads only the selected Stat module when the refresh flag changes', async () => {
  setTestFlags({ 'dataviz.statRefresh': false });
  const load = builtInPlugins['core:plugin/stat'];
  if (typeof load !== 'function') {
    throw new Error('Stat must be loaded asynchronously');
  }

  expect(mockLoadedVersions).toEqual([]);
  expect((await load()).plugin).toEqual({ version: 'v1' });
  expect(mockLoadedVersions).toEqual(['v1']);

  setTestFlags({ 'dataviz.statRefresh': true });
  expect((await load()).plugin).toEqual({ version: 'v2' });
  expect(mockLoadedVersions).toEqual(['v1', 'v2']);
});
