import { type StarsList } from 'app/api/clients/collections/v1alpha1';

import { findStarredNames, userStarsFieldSelector } from './utils';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: { user: { uid: 'u123' } },
}));

const starsList = (resources: Array<{ group: string; kind: string; names: string[] }>): StarsList =>
  ({ items: [{ spec: { resource: resources } }] }) as unknown as StarsList;

describe('findStarredNames', () => {
  it('returns names for the matching group/kind', () => {
    const stars = starsList([
      { group: 'dashboard.grafana.app', kind: 'Dashboard', names: ['d1'] },
      { group: 'folder.grafana.app', kind: 'Folder', names: ['fa', 'fb'] },
    ]);
    expect(findStarredNames(stars, 'folder.grafana.app', 'Folder')).toEqual(['fa', 'fb']);
    expect(findStarredNames(stars, 'dashboard.grafana.app', 'Dashboard')).toEqual(['d1']);
  });

  it('returns [] when the group/kind is absent', () => {
    const stars = starsList([{ group: 'dashboard.grafana.app', kind: 'Dashboard', names: ['d1'] }]);
    expect(findStarredNames(stars, 'folder.grafana.app', 'Folder')).toEqual([]);
  });

  it('returns [] for undefined stars or empty items', () => {
    expect(findStarredNames(undefined, 'folder.grafana.app', 'Folder')).toEqual([]);
    expect(findStarredNames({ items: [] } as unknown as StarsList, 'folder.grafana.app', 'Folder')).toEqual([]);
  });
});

describe('userStarsFieldSelector', () => {
  it('builds the field selector from the current user uid', () => {
    expect(userStarsFieldSelector()).toBe('metadata.name=user-u123');
  });
});
