import { ScopeDashboardBinding } from '@grafana/data';

import { ScopeNavigation } from '../../dashboards/types';

// Mock subScope navigation items (specific to these tests)
export const navigationWithSubScope: ScopeNavigation = {
  metadata: { name: 'subscope-nav-1' },
  spec: {
    scope: 'grafana',
    subScope: 'mimir',
    url: '/d/subscope-dashboard-1',
  },
  status: {
    title: 'Mimir Dashboards',
    groups: [], // subScope items ignore groups
  },
};

export const navigationWithSubScope2: ScopeNavigation = {
  metadata: { name: 'subscope-nav-2' },
  spec: {
    scope: 'grafana',
    subScope: 'mimir',
    url: '/d/subscope-dashboard-2',
  },
  status: {
    title: 'Mimir Overview',
    groups: [],
  },
};

export const navigationWithSubScopeDifferent: ScopeNavigation = {
  metadata: { name: 'subscope-nav-3' },
  spec: {
    scope: 'grafana',
    subScope: 'loki',
    url: '/d/subscope-dashboard-3',
  },
  status: {
    title: 'Loki Dashboards',
    groups: [],
  },
};

export const navigationWithSubScopeAndGroups: ScopeNavigation = {
  metadata: { name: 'subscope-nav-groups' },
  spec: {
    scope: 'grafana',
    subScope: 'mimir',
    url: '/d/subscope-dashboard-groups',
  },
  status: {
    title: 'Mimir with Groups',
    groups: ['Group1', 'Group2'], // Should be ignored for subScope items
  },
};

const generateScopeDashboardBinding = (dashboardTitle: string, groups?: string[], dashboardId?: string) => ({
  metadata: { name: `${dashboardTitle}-name` },
  spec: {
    dashboard: `${dashboardId ?? dashboardTitle}-dashboard`,
    scope: `${dashboardTitle}-scope`,
  },
  status: {
    dashboardTitle,
    groups,
  },
});

export const dashboardWithoutFolder: ScopeDashboardBinding = generateScopeDashboardBinding('Without Folder');
export const dashboardWithOneFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With one folder', [
  'Folder 1',
]);
export const dashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding('With two folders', [
  'Folder 1',
  'Folder 2',
]);
export const alternativeDashboardWithTwoFolders: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative with two folders',
  ['Folder 1', 'Folder 2'],
  'With two folders'
);
export const dashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding('With root folder', ['']);
export const alternativeDashboardWithRootFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'Alternative With root folder',
  [''],
  'With root folder'
);
export const dashboardWithRootFolderAndOtherFolder: ScopeDashboardBinding = generateScopeDashboardBinding(
  'With root folder and other folder',
  ['', 'Folder 3']
);
