import { SearchCtrl } from '../components/search/search';
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        user: { orgId: 1 },
    },
}); });
describe('SearchCtrl', function () {
    var searchSrvStub = {
        search: function (options) { },
        getDashboardTags: function () { },
    };
    var ctrl = new SearchCtrl({ $on: function () { } }, {}, {}, searchSrvStub);
    describe('Given an empty result', function () {
        beforeEach(function () {
            ctrl.results = [];
        });
        describe('When navigating down one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
            });
            it('should not navigate', function () {
                expect(ctrl.selectedIndex).toBe(0);
            });
        });
        describe('When navigating up one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(-1);
            });
            it('should not navigate', function () {
                expect(ctrl.selectedIndex).toBe(0);
            });
        });
    });
    describe('Given a result of one selected collapsed folder with no dashboards and a root folder with 2 dashboards', function () {
        beforeEach(function () {
            ctrl.results = [
                {
                    id: 1,
                    title: 'folder',
                    items: [],
                    selected: true,
                    expanded: false,
                    toggle: function (i) { return (i.expanded = !i.expanded); },
                },
                {
                    id: 0,
                    title: 'General',
                    items: [{ id: 3, selected: false }, { id: 5, selected: false }],
                    selected: false,
                    expanded: true,
                    toggle: function (i) { return (i.expanded = !i.expanded); },
                },
            ];
        });
        describe('When navigating down one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
            });
            it('should select first dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeTruthy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
        describe('When navigating down two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select last dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating down three steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select first folder', function () {
                expect(ctrl.results[0].selected).toBeTruthy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
        describe('When navigating up one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(-1);
            });
            it('should select last dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating up two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(-1);
                ctrl.moveSelection(-1);
            });
            it('should select first dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeTruthy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
    });
    describe('Given a result of one selected collapsed folder with 2 dashboards and a root folder with 2 dashboards', function () {
        beforeEach(function () {
            ctrl.results = [
                {
                    id: 1,
                    title: 'folder',
                    items: [{ id: 2, selected: false }, { id: 4, selected: false }],
                    selected: true,
                    expanded: false,
                    toggle: function (i) { return (i.expanded = !i.expanded); },
                },
                {
                    id: 0,
                    title: 'General',
                    items: [{ id: 3, selected: false }, { id: 5, selected: false }],
                    selected: false,
                    expanded: true,
                    toggle: function (i) { return (i.expanded = !i.expanded); },
                },
            ];
        });
        describe('When navigating down one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
            });
            it('should select first dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeTruthy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
        describe('When navigating down two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select last dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating down three steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select first folder', function () {
                expect(ctrl.results[0].selected).toBeTruthy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
        describe('When navigating up one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(-1);
            });
            it('should select last dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeFalsy();
                expect(ctrl.results[1].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating up two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 0;
                ctrl.moveSelection(-1);
                ctrl.moveSelection(-1);
            });
            it('should select first dashboard in root folder', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[1].selected).toBeFalsy();
                expect(ctrl.results[1].items[0].selected).toBeTruthy();
                expect(ctrl.results[1].items[1].selected).toBeFalsy();
            });
        });
    });
    describe('Given a result of a search with 2 dashboards where the first is selected', function () {
        beforeEach(function () {
            ctrl.results = [
                {
                    hideHeader: true,
                    items: [{ id: 3, selected: true }, { id: 5, selected: false }],
                    selected: false,
                    expanded: true,
                    toggle: function (i) { return (i.expanded = !i.expanded); },
                },
            ];
        });
        describe('When navigating down one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 1;
                ctrl.moveSelection(1);
            });
            it('should select last dashboard', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating down two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 1;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select first dashboard', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeTruthy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
            });
        });
        describe('When navigating down three steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 1;
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
                ctrl.moveSelection(1);
            });
            it('should select last dashboard', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating up one step', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 1;
                ctrl.moveSelection(-1);
            });
            it('should select last dashboard', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[1].selected).toBeTruthy();
            });
        });
        describe('When navigating up two steps', function () {
            beforeEach(function () {
                ctrl.selectedIndex = 1;
                ctrl.moveSelection(-1);
                ctrl.moveSelection(-1);
            });
            it('should select first dashboard', function () {
                expect(ctrl.results[0].selected).toBeFalsy();
                expect(ctrl.results[0].items[0].selected).toBeTruthy();
                expect(ctrl.results[0].items[1].selected).toBeFalsy();
            });
        });
    });
});
//# sourceMappingURL=search.test.js.map