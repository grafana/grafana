import { type StarsList } from 'app/api/clients/collections/v1alpha1';
import { contextSrv } from 'app/core/services/context_srv';

import { canUseStars, findStarredNames, userStarsFieldSelector } from './utils';

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: { isSignedIn: true, user: { uid: 'u123' } },
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

describe('canUseStars', () => {
  it('is true for a signed-in user with a uid', () => {
    expect(canUseStars()).toBe(true);
  });

  it('is false for an anonymous user', () => {
    jest.replaceProperty(contextSrv, 'isSignedIn', false);
    expect(canUseStars()).toBe(false);
  });

  it('is false for a signed-in identity without a uid', () => {
    jest.replaceProperty(contextSrv.user, 'uid', '');
    expect(canUseStars()).toBe(false);
  });
});
