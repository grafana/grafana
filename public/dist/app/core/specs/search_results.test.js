import { SearchResultsCtrl } from '../components/search/search_results';
import { beforeEach, afterEach } from 'test/lib/common';
import appEvents from 'app/core/app_events';
jest.mock('app/core/app_events', function () {
    return {
        emit: jest.fn(),
    };
});
describe('SearchResultsCtrl', function () {
    var ctrl;
    describe('when checking an item that is not checked', function () {
        var item = { checked: false };
        var selectionChanged = false;
        beforeEach(function () {
            ctrl = new SearchResultsCtrl({});
            ctrl.onSelectionChanged = function () { return (selectionChanged = true); };
            ctrl.toggleSelection(item);
        });
        it('should set checked to true', function () {
            expect(item.checked).toBeTruthy();
        });
        it('should trigger selection changed callback', function () {
            expect(selectionChanged).toBeTruthy();
        });
    });
    describe('when checking an item that is checked', function () {
        var item = { checked: true };
        var selectionChanged = false;
        beforeEach(function () {
            ctrl = new SearchResultsCtrl({});
            ctrl.onSelectionChanged = function () { return (selectionChanged = true); };
            ctrl.toggleSelection(item);
        });
        it('should set checked to false', function () {
            expect(item.checked).toBeFalsy();
        });
        it('should trigger selection changed callback', function () {
            expect(selectionChanged).toBeTruthy();
        });
    });
    describe('when selecting a tag', function () {
        var selectedTag = null;
        beforeEach(function () {
            ctrl = new SearchResultsCtrl({});
            ctrl.onTagSelected = function (tag) { return (selectedTag = tag); };
            ctrl.selectTag('tag-test');
        });
        it('should trigger tag selected callback', function () {
            expect(selectedTag['$tag']).toBe('tag-test');
        });
    });
    describe('when toggle a collapsed folder', function () {
        var folderExpanded = false;
        beforeEach(function () {
            ctrl = new SearchResultsCtrl({});
            ctrl.onFolderExpanding = function () {
                folderExpanded = true;
            };
            var folder = {
                expanded: false,
                toggle: function () { return Promise.resolve(folder); },
            };
            ctrl.toggleFolderExpand(folder);
        });
        it('should trigger folder expanding callback', function () {
            expect(folderExpanded).toBeTruthy();
        });
    });
    describe('when toggle an expanded folder', function () {
        var folderExpanded = false;
        beforeEach(function () {
            ctrl = new SearchResultsCtrl({});
            ctrl.onFolderExpanding = function () {
                folderExpanded = true;
            };
            var folder = {
                expanded: true,
                toggle: function () { return Promise.resolve(folder); },
            };
            ctrl.toggleFolderExpand(folder);
        });
        it('should not trigger folder expanding callback', function () {
            expect(folderExpanded).toBeFalsy();
        });
    });
    describe('when clicking on a link in search result', function () {
        var dashPath = 'dashboard/path';
        var $location = { path: function () { return dashPath; } };
        var appEventsMock = appEvents;
        describe('with the same url as current path', function () {
            beforeEach(function () {
                ctrl = new SearchResultsCtrl($location);
                var item = { url: dashPath };
                ctrl.onItemClick(item);
            });
            it('should close the search', function () {
                expect(appEventsMock.emit.mock.calls.length).toBe(1);
                expect(appEventsMock.emit.mock.calls[0][0]).toBe('hide-dash-search');
            });
        });
        describe('with a different url than current path', function () {
            beforeEach(function () {
                ctrl = new SearchResultsCtrl($location);
                var item = { url: 'another/path' };
                ctrl.onItemClick(item);
            });
            it('should do nothing', function () {
                expect(appEventsMock.emit.mock.calls.length).toBe(0);
            });
        });
        afterEach(function () {
            appEventsMock.emit.mockClear();
        });
    });
});
//# sourceMappingURL=search_results.test.js.map