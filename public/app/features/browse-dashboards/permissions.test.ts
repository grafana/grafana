import { MOCK_STARRED_KIND } from '@grafana/test-utils/unstable';
import { registerStarredKind } from 'app/features/stars/kinds';

import { canEditItemType } from './permissions';
import { type BrowseDashboardsPermissions } from './types';

describe('canEditItemType', () => {
  const dashboardsOnly: BrowseDashboardsPermissions = { canEditFolders: false, canEditDashboards: true };
  const foldersOnly: BrowseDashboardsPermissions = { canEditFolders: true, canEditDashboards: false };

  it.each([
    { kind: 'folder', permissions: foldersOnly, expected: true },
    { kind: 'folder', permissions: dashboardsOnly, expected: false },
    { kind: 'dashboard', permissions: dashboardsOnly, expected: true },
    { kind: 'dashboard', permissions: foldersOnly, expected: false },
    // The search table's select-all header asks about `*`, which follows dashboard permissions
    { kind: '*', permissions: dashboardsOnly, expected: true },
    { kind: '*', permissions: foldersOnly, expected: false },
  ])('answers $expected for $kind with edit rights on $permissions', ({ kind, permissions, expected }) => {
    expect(canEditItemType(kind, permissions)).toBe(expected);
  });

  it("never lets a registered kind's objects be edited, whatever the permissions", () => {
    const unregister = registerStarredKind(MOCK_STARRED_KIND);
    const everything = { ...dashboardsOnly, canEditFolders: true, canDeleteDashboards: true };

    expect(canEditItemType('things.ext.grafana.app/Thing', everything)).toBe(false);
    unregister();
  });
});
