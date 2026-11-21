import { store } from '@grafana/data';

import { SECTION_STORAGE_KEY } from './constants';
import { type SearchQueryParams } from './types';
import { cleanupOldExpandedFolders, parseRouteParams } from './utils';

describe('Search utils', () => {
  describe('parseRouteParams', () => {
    it('should remove all undefined keys', () => {
      const params: Partial<SearchQueryParams> = { sort: undefined, tag: undefined, query: 'test' };

      expect(parseRouteParams(params)).toEqual({
        query: 'test',
      });
    });

    it('should return tag as array, if present', () => {
      const params = { sort: undefined, tag: 'test', query: 'test' };
      expect(parseRouteParams(params)).toEqual({
        query: 'test',
        tag: ['test'],
      });

      const params2: Partial<SearchQueryParams> = { sort: undefined, tag: ['test'], query: 'test' };
      expect(parseRouteParams(params2)).toEqual({
        query: 'test',
        tag: ['test'],
      });
    });

    it('should return ownerReference as array, if present', () => {
      const params = { ownerReference: 'iam.grafana.app/v0alpha1/Team/test-team', query: 'test' };
      expect(parseRouteParams(params)).toEqual({
        query: 'test',
        ownerReference: ['iam.grafana.app/v0alpha1/Team/test-team'],
      });

      const params2: Partial<SearchQueryParams> = {
        ownerReference: ['iam.grafana.app/v0alpha1/Team/test-team'],
        query: 'test',
      };
      expect(parseRouteParams(params2)).toEqual({
        query: 'test',
        ownerReference: ['iam.grafana.app/v0alpha1/Team/test-team'],
      });
    });

    it('should prepend folder:{folder} to the query if folder is present', () => {
      expect(parseRouteParams({ folder: 'current' })).toEqual({
        folder: 'current',
        query: 'folder:current ',
      });
      // Prepend to exiting query
      const params: Partial<SearchQueryParams> = { query: 'test', folder: 'current' };
      expect(parseRouteParams(params)).toEqual({
        folder: 'current',
        query: 'folder:current test',
      });
    });
  });

  describe('cleanupOldExpandedFolders', () => {
    it('should remove old prefixed keys and keep other keys', () => {
      const oldKey = `${SECTION_STORAGE_KEY}.folderA`;
      const otherKey = 'grafana.someOtherKey';

      store.set(oldKey, '1');
      store.set(otherKey, '1');

      cleanupOldExpandedFolders();

      expect(store.exists(oldKey)).toBe(false);
      expect(store.exists(otherKey)).toBe(true);
    });

    it('should remove all prefixed keys regardless of count', () => {
      const keys = [`${SECTION_STORAGE_KEY}.a`, `${SECTION_STORAGE_KEY}.b`, `${SECTION_STORAGE_KEY}.c`];
      keys.forEach((key) => store.set(key, '1'));

      cleanupOldExpandedFolders();

      keys.forEach((key) => expect(store.exists(key)).toBe(false));
    });
  });
});
