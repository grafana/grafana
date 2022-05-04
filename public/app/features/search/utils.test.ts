import { sections, searchResults, checkedGeneralFolder, checkedOtherFolder, folderViewAllChecked } from './testData';
import { SearchQueryParams } from './types';
import {
  getCheckedDashboardsUids,
  getCheckedUids,
  getFlattenedSections,
  mergeReducers,
  parseRouteParams,
} from './utils';

describe('Search utils', () => {
  describe('getFlattenedSections', () => {
    it('should return an array of items plus children for expanded items', () => {
      const flatSections = getFlattenedSections(sections as any[]);
      expect(flatSections).toHaveLength(10);
      expect(flatSections).toEqual([
        'Starred',
        'Starred-1',
        'Recent',
        '2',
        '2568',
        '4074',
        '0',
        '0-4069',
        '0-4072',
        '0-1',
      ]);
    });
  });

  describe('mergeReducers', () => {
    const reducer1 = (state: any = { reducer1: false }, action: any) => {
      if (action.type === 'reducer1') {
        return { ...state, reducer1: !state.reducer1 };
      }
      return state;
    };

    const reducer2 = (state: any = { reducer2: false }, action: any) => {
      if (action.type === 'reducer2') {
        return { ...state, reducer2: !state.reducer2 };
      }
      return state;
    };

    const mergedReducers = mergeReducers([reducer1, reducer2]);

    it('should merge state from all reducers into one without nesting', () => {
      expect(mergedReducers({ reducer1: false }, { type: '' })).toEqual({ reducer1: false });
    });

    it('should correctly set state from multiple reducers', () => {
      const state = { reducer1: false, reducer2: true };
      const newState = mergedReducers(state, { type: 'reducer2' });
      expect(newState).toEqual({ reducer1: false, reducer2: false });
      const newState2 = mergedReducers(newState, { type: 'reducer1' });
      expect(newState2).toEqual({ reducer1: true, reducer2: false });
    });
  });

  describe('getCheckedUids', () => {
    it('should not return any UIDs if no items are checked', () => {
      expect(getCheckedUids(sections)).toEqual({ folders: [], dashboards: [] });
    });

    it('should return only dashboard UIDs if the General folder is checked', () => {
      expect(getCheckedUids(checkedGeneralFolder)).toEqual({
        folders: [],
        dashboards: ['general-abc', 'general-def', 'general-ghi'],
      });
    });

    it('should return only dashboard UIDs if all items are checked when viewing a folder', () => {
      expect(getCheckedUids(folderViewAllChecked)).toEqual({
        folders: [],
        dashboards: ['other-folder-dash-abc', 'other-folder-dash-def'],
      });
    });

    it('should return folder + dashboard UIDs when folder is checked in the root view', () => {
      expect(getCheckedUids(checkedOtherFolder)).toEqual({
        folders: ['other-folder-abc'],
        dashboards: ['other-folder-dash-abc', 'other-folder-dash-def'],
      });
    });
  });

  describe('getCheckedDashboardsUids', () => {
    it('should get uids of all checked dashboards', () => {
      expect(getCheckedDashboardsUids(searchResults)).toEqual(['lBdLINUWk', '8DY63kQZk']);
    });
  });

  describe('parseRouteParams', () => {
    it('should remove all undefined keys', () => {
      const params: Partial<SearchQueryParams> = { sort: undefined, tag: undefined, query: 'test' };

      expect(parseRouteParams(params)).toEqual({
        query: 'test',
      });
    });

    it('should return tag as array, if present', () => {
      //@ts-ignore
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

    it('should return sort as a SelectableValue', () => {
      const params: Partial<SearchQueryParams> = { sort: 'test' };

      expect(parseRouteParams(params)).toEqual({
        sort: { value: 'test' },
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
});
