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
    beforeEach(() => {
      window.localStorage.clear();
    });

    it('should remove old folder keys and keep other keys', () => {
      window.localStorage.setItem(`${SECTION_STORAGE_KEY}.general`, 'true');
      window.localStorage.setItem(`${SECTION_STORAGE_KEY}.my folder`, 'true');
      window.localStorage.setItem(SECTION_STORAGE_KEY, 'keep');
      window.localStorage.setItem('other.key', 'keep');

      cleanupOldExpandedFolders();

      expect(window.localStorage.getItem(`${SECTION_STORAGE_KEY}.general`)).toBeNull();
      expect(window.localStorage.getItem(`${SECTION_STORAGE_KEY}.my folder`)).toBeNull();
      expect(window.localStorage.getItem(SECTION_STORAGE_KEY)).toBe('keep');
      expect(window.localStorage.getItem('other.key')).toBe('keep');
    });
  });
});
