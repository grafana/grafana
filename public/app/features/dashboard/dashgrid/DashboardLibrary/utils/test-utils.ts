import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard } from '../types';

export const createMockPluginDashboard = (overrides: Partial<PluginDashboard> = {}): PluginDashboard => ({
  dashboardId: 1,
  uid: 'dash-uid',
  title: 'Test Provisioned Dashboard',
  description: 'Test plugin dashboard',
  path: 'dashboards/test.json',
  pluginId: 'prometheus',
  imported: false,
  importedRevision: 0,
  importedUri: '',
  importedUrl: '',
  removed: false,
  revision: 1,
  slug: 'test-dashboard',
  ...overrides,
});

export const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  id: 123,
  name: 'Test Dashboard',
  description: 'Test description',
  datasource: 'Prometheus',
  orgName: 'Test Org',
  userName: 'testuser',
  publishedAt: '',
  updatedAt: '',
  downloads: 0,
  slug: 'test-dashboard',
  ...overrides,
});
