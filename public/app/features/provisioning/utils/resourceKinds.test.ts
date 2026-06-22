import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getIconForKind } from 'app/features/search/service/utils';

import {
  RESOURCE_KINDS,
  getAvailableResourceKinds,
  getKindInfoByItemType,
  getKindInfoByResource,
  getKindInfoByStatGroup,
  isResourceKindAvailable,
} from './resourceKinds';

describe('resourceKinds registry', () => {
  it('exposes an info record per kind with consistent identifiers', () => {
    expect(RESOURCE_KINDS.dashboard).toMatchObject({
      group: 'dashboard.grafana.app',
      kind: 'Dashboard',
      resource: 'dashboards',
      itemType: 'Dashboard',
    });
    expect(RESOURCE_KINDS.folder).toMatchObject({
      group: 'folder.grafana.app',
      kind: 'Folder',
      resource: 'folders',
      itemType: 'Folder',
    });
  });

  it('sources icons from the search package', () => {
    expect(RESOURCE_KINDS.dashboard.icon).toBe(getIconForKind('dashboard'));
    expect(RESOURCE_KINDS.folder.icon).toBe(getIconForKind('folder'));
  });
});

describe('getKindInfoByResource', () => {
  it('resolves by plural resource name', () => {
    expect(getKindInfoByResource('dashboards')).toBe(RESOURCE_KINDS.dashboard);
    expect(getKindInfoByResource('folders')).toBe(RESOURCE_KINDS.folder);
  });

  it('returns undefined for unknown or missing resources', () => {
    expect(getKindInfoByResource('unknown-type')).toBeUndefined();
    expect(getKindInfoByResource(undefined)).toBeUndefined();
  });
});

describe('getKindInfoByItemType', () => {
  it('resolves by item type', () => {
    expect(getKindInfoByItemType('Dashboard')).toBe(RESOURCE_KINDS.dashboard);
    expect(getKindInfoByItemType('Folder')).toBe(RESOURCE_KINDS.folder);
  });

  it('returns undefined for the non-resource File type', () => {
    expect(getKindInfoByItemType('File')).toBeUndefined();
  });
});

describe('getKindInfoByStatGroup', () => {
  it('matches the full API group', () => {
    expect(getKindInfoByStatGroup('dashboard.grafana.app')).toBe(RESOURCE_KINDS.dashboard);
    expect(getKindInfoByStatGroup('folder.grafana.app')).toBe(RESOURCE_KINDS.folder);
  });

  it('matches the legacy short plural form', () => {
    expect(getKindInfoByStatGroup('folders')).toBe(RESOURCE_KINDS.folder);
  });

  it('returns undefined for unknown groups', () => {
    expect(getKindInfoByStatGroup('alert.grafana.app')).toBeUndefined();
  });
});

describe('getRoute', () => {
  it('builds in-app routes per kind', () => {
    expect(RESOURCE_KINDS.dashboard.getRoute('abc')).toBe('/d/abc');
    expect(RESOURCE_KINDS.folder.getRoute('xyz')).toBe('/dashboards/f/xyz');
  });
});

describe('getAvailableResourceKinds', () => {
  it('falls back to all known kinds when availableResources is unset', () => {
    expect(getAvailableResourceKinds(undefined)).toEqual([RESOURCE_KINDS.folder, RESOURCE_KINDS.dashboard]);
  });

  it('only returns kinds present and not disabled', () => {
    const available: SupportedResource[] = [
      { group: 'dashboard.grafana.app', kind: 'Dashboard' },
      { group: 'folder.grafana.app', kind: 'Folder', disabled: true },
    ];

    const result = getAvailableResourceKinds(available);

    expect(result).toEqual([RESOURCE_KINDS.dashboard]);
    expect(isResourceKindAvailable(RESOURCE_KINDS.dashboard, available)).toBe(true);
    expect(isResourceKindAvailable(RESOURCE_KINDS.folder, available)).toBe(false);
  });

  it('returns no kinds when none are declared', () => {
    expect(getAvailableResourceKinds([])).toEqual([]);
  });
});
