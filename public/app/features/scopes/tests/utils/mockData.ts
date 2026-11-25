import { type ScopeNavigation } from '../../dashboards/types';

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

// Navigations that share a dashboardId share a name and URL, so the drawer dedupes them into one item.
const generateScopeNavigation = (title: string, groups?: string[], dashboardId?: string): ScopeNavigation => ({
  metadata: { name: `${dashboardId ?? title}-dashboard` },
  spec: {
    url: `/d/${dashboardId ?? title}-dashboard`,
    scope: `${title}-scope`,
  },
  status: {
    title,
    groups,
  },
});

export const dashboardWithoutFolder: ScopeNavigation = generateScopeNavigation('Without Folder');
export const dashboardWithOneFolder: ScopeNavigation = generateScopeNavigation('With one folder', ['Folder 1']);
export const dashboardWithTwoFolders: ScopeNavigation = generateScopeNavigation('With two folders', [
  'Folder 1',
  'Folder 2',
]);
export const alternativeDashboardWithTwoFolders: ScopeNavigation = generateScopeNavigation(
  'Alternative with two folders',
  ['Folder 1', 'Folder 2'],
  'With two folders'
);
export const dashboardWithRootFolder: ScopeNavigation = generateScopeNavigation('With root folder', ['']);
export const alternativeDashboardWithRootFolder: ScopeNavigation = generateScopeNavigation(
  'Alternative With root folder',
  [''],
  'With root folder'
);
export const dashboardWithRootFolderAndOtherFolder: ScopeNavigation = generateScopeNavigation(
  'With root folder and other folder',
  ['', 'Folder 3']
);
