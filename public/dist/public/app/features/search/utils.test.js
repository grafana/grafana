import { __assign, __read, __spreadArray } from "tslib";
import { findSelected, getCheckedDashboardsUids, getCheckedUids, getFlattenedSections, markSelected, mergeReducers, parseRouteParams, } from './utils';
import { sections, searchResults } from './testData';
describe('Search utils', function () {
    describe('getFlattenedSections', function () {
        it('should return an array of items plus children for expanded items', function () {
            var flatSections = getFlattenedSections(sections);
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
        describe('markSelected', function () {
            it('should correctly mark the section item without id as selected', function () {
                var results = markSelected(sections, 'Recent');
                //@ts-ignore
                expect(results[1].selected).toBe(true);
            });
            it('should correctly mark the section item with id as selected', function () {
                var results = markSelected(sections, '4074');
                //@ts-ignore
                expect(results[4].selected).toBe(true);
            });
            it('should mark all other sections as not selected', function () {
                var results = markSelected(sections, 'Starred');
                var newResults = markSelected(results, '0');
                //@ts-ignore
                expect(newResults[0].selected).toBeFalsy();
                expect(newResults[5].selected).toBeTruthy();
            });
            it('should correctly mark an item of a section as selected', function () {
                var results = markSelected(sections, '0-4072');
                expect(results[5].items[1].selected).toBeTruthy();
            });
            it('should not mark an item as selected for non-expanded section', function () {
                var results = markSelected(sections, 'Recent-4072');
                expect(results[1].items[0].selected).toBeFalsy();
            });
            it('should mark all other items as not selected', function () {
                var results = markSelected(sections, '0-4069');
                var newResults = markSelected(results, '0-1');
                //@ts-ignore
                expect(newResults[5].items[0].selected).toBeFalsy();
                expect(newResults[5].items[1].selected).toBeFalsy();
                expect(newResults[5].items[2].selected).toBeTruthy();
            });
            it('should correctly select one of the same items in different sections', function () {
                var results = markSelected(sections, 'Starred-1');
                expect(results[0].items[0].selected).toBeTruthy();
                // Same item in diff section
                expect(results[5].items[2].selected).toBeFalsy();
                // Switch order
                var newResults = markSelected(sections, '0-1');
                expect(newResults[0].items[0].selected).toBeFalsy();
                // Same item in diff section
                expect(newResults[5].items[2].selected).toBeTruthy();
            });
        });
        describe('findSelected', function () {
            it('should find selected section', function () {
                var results = __spreadArray(__spreadArray([], __read(sections), false), [{ id: 'Test', selected: true }], false);
                var found = findSelected(results);
                expect(found === null || found === void 0 ? void 0 : found.id).toEqual('Test');
            });
            it('should find selected item', function () {
                var results = [{ expanded: true, id: 'Test', items: [{ id: 1 }, { id: 2, selected: true }, { id: 3 }] }];
                var found = findSelected(results);
                expect(found === null || found === void 0 ? void 0 : found.id).toEqual(2);
            });
        });
    });
    describe('mergeReducers', function () {
        var reducer1 = function (state, action) {
            if (state === void 0) { state = { reducer1: false }; }
            if (action.type === 'reducer1') {
                return __assign(__assign({}, state), { reducer1: !state.reducer1 });
            }
            return state;
        };
        var reducer2 = function (state, action) {
            if (state === void 0) { state = { reducer2: false }; }
            if (action.type === 'reducer2') {
                return __assign(__assign({}, state), { reducer2: !state.reducer2 });
            }
            return state;
        };
        var mergedReducers = mergeReducers([reducer1, reducer2]);
        it('should merge state from all reducers into one without nesting', function () {
            expect(mergedReducers({ reducer1: false }, { type: '' })).toEqual({ reducer1: false });
        });
        it('should correctly set state from multiple reducers', function () {
            var state = { reducer1: false, reducer2: true };
            var newState = mergedReducers(state, { type: 'reducer2' });
            expect(newState).toEqual({ reducer1: false, reducer2: false });
            var newState2 = mergedReducers(newState, { type: 'reducer1' });
            expect(newState2).toEqual({ reducer1: true, reducer2: false });
        });
    });
    describe('getCheckedUids', function () {
        it('should return object with empty arrays if no checked items are available', function () {
            expect(getCheckedUids(sections)).toEqual({ folders: [], dashboards: [] });
        });
        it('should return uids for all checked items', function () {
            expect(getCheckedUids(searchResults)).toEqual({
                folders: ['JB_zdOUWk'],
                dashboards: ['lBdLINUWk', '8DY63kQZk'],
            });
        });
    });
    describe('getCheckedDashboardsUids', function () {
        it('should get uids of all checked dashboards', function () {
            expect(getCheckedDashboardsUids(searchResults)).toEqual(['lBdLINUWk', '8DY63kQZk']);
        });
    });
    describe('parseRouteParams', function () {
        it('should remove all undefined keys', function () {
            var params = { sort: undefined, tag: undefined, query: 'test' };
            expect(parseRouteParams(params)).toEqual({
                query: 'test',
            });
        });
        it('should return tag as array, if present', function () {
            //@ts-ignore
            var params = { sort: undefined, tag: 'test', query: 'test' };
            expect(parseRouteParams(params)).toEqual({
                query: 'test',
                tag: ['test'],
            });
            var params2 = { sort: undefined, tag: ['test'], query: 'test' };
            expect(parseRouteParams(params2)).toEqual({
                query: 'test',
                tag: ['test'],
            });
        });
        it('should return sort as a SelectableValue', function () {
            var params = { sort: 'test' };
            expect(parseRouteParams(params)).toEqual({
                sort: { value: 'test' },
            });
        });
        it('should prepend folder:{folder} to the query if folder is present', function () {
            expect(parseRouteParams({ folder: 'current' })).toEqual({
                folder: 'current',
                query: 'folder:current ',
            });
            // Prepend to exiting query
            var params = { query: 'test', folder: 'current' };
            expect(parseRouteParams(params)).toEqual({
                folder: 'current',
                query: 'folder:current test',
            });
        });
    });
});
//# sourceMappingURL=utils.test.js.map