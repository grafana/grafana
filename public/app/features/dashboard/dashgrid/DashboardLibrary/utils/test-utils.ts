import { PluginDashboard } from 'app/types/plugins';

import { GnetDashboard } from '../types';

/**
 * Creates a complete mock PluginDashboard with all fields.
 * Use overrides to customize specific fields for your test.
 */
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

/**
 * Creates a complete mock GnetDashboard with all fields.
 * Use overrides to customize specific fields for your test.
 */
export const createMockGnetDashboard = (overrides: Partial<GnetDashboard> = {}): GnetDashboard => ({
  // Required fields
  id: 123,
  name: 'Test Dashboard',
  description: 'Test description',
  slug: 'test-dashboard',
  downloads: 1000,
  datasource: 'prometheus',
  // Optional fields - included for complete mocks
  screenshots: undefined,
  logos: undefined,
  json: undefined,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
  publishedAt: '2025-01-01T00:00:00.000Z',
  orgId: 1,
  orgName: 'Test Org',
  orgSlug: 'test-org',
  userId: 100,
  userName: 'testuser',
  panelTypeSlugs: ['timeseries', 'stat', 'gauge'],
  ...overrides,
});
