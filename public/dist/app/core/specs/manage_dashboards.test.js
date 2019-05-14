import * as tslib_1 from "tslib";
// @ts-ignore
import q from 'q';
import { ManageDashboardsCtrl, } from 'app/core/components/manage_dashboards/manage_dashboards';
var mockSection = function (overides) {
    var defaultSection = {
        id: 0,
        items: [],
        checked: false,
        expanded: false,
        hideHeader: false,
        icon: '',
        score: 0,
        title: 'Some Section',
        toggle: jest.fn(),
        uid: 'someuid',
        url: '/some/url/',
    };
    return tslib_1.__assign({}, defaultSection, overides);
};
describe('ManageDashboards', function () {
    var ctrl;
    describe('when browsing dashboards', function () {
        beforeEach(function () {
            var tags = [];
            var response = [
                {
                    id: 410,
                    title: 'afolder',
                    type: 'dash-folder',
                    items: [
                        {
                            id: 399,
                            title: 'Dashboard Test',
                            url: 'dashboard/db/dashboard-test',
                            icon: 'fa fa-folder',
                            tags: tags,
                            isStarred: false,
                        },
                    ],
                    tags: tags,
                    isStarred: false,
                },
                {
                    id: 0,
                    title: 'General',
                    icon: 'fa fa-folder-open',
                    uri: 'db/something-else',
                    type: 'dash-db',
                    items: [
                        {
                            id: 500,
                            title: 'Dashboard Test',
                            url: 'dashboard/db/dashboard-test',
                            icon: 'fa fa-folder',
                            tags: tags,
                            isStarred: false,
                        },
                    ],
                    tags: tags,
                    isStarred: false,
                },
            ];
            ctrl = createCtrlWithStubs(response);
            return ctrl.refreshList();
        });
        it('should set checked to false on all sections and children', function () {
            expect(ctrl.sections.length).toEqual(2);
            expect(ctrl.sections[0].checked).toEqual(false);
            expect(ctrl.sections[0].items[0].checked).toEqual(false);
            expect(ctrl.sections[1].checked).toEqual(false);
            expect(ctrl.sections[1].items[0].checked).toEqual(false);
            expect(ctrl.sections[0].hideHeader).toBeFalsy();
        });
    });
    describe('when browsing dashboards for a folder', function () {
        beforeEach(function () {
            var tags = [];
            var response = [
                {
                    id: 410,
                    title: 'afolder',
                    type: 'dash-folder',
                    items: [
                        {
                            id: 399,
                            title: 'Dashboard Test',
                            url: 'dashboard/db/dashboard-test',
                            icon: 'fa fa-folder',
                            tags: tags,
                            isStarred: false,
                        },
                    ],
                    tags: tags,
                    isStarred: false,
                },
            ];
            ctrl = createCtrlWithStubs(response);
            ctrl.folderId = 410;
            return ctrl.refreshList();
        });
        it('should set hide header to true on section', function () {
            expect(ctrl.sections[0].hideHeader).toBeTruthy();
        });
    });
    describe('when searching dashboards', function () {
        beforeEach(function () {
            var tags = [];
            var response = [
                {
                    checked: false,
                    expanded: true,
                    hideHeader: true,
                    items: [
                        {
                            id: 399,
                            title: 'Dashboard Test',
                            url: 'dashboard/db/dashboard-test',
                            icon: 'fa fa-folder',
                            tags: tags,
                            isStarred: false,
                            folderId: 410,
                            folderUid: 'uid',
                            folderTitle: 'Folder',
                            folderUrl: '/dashboards/f/uid/folder',
                        },
                        {
                            id: 500,
                            title: 'Dashboard Test',
                            url: 'dashboard/db/dashboard-test',
                            icon: 'fa fa-folder',
                            tags: tags,
                            folderId: 499,
                            isStarred: false,
                        },
                    ],
                },
            ];
            ctrl = createCtrlWithStubs(response);
        });
        describe('with query filter', function () {
            beforeEach(function () {
                ctrl.query.query = 'd';
                ctrl.canMove = true;
                ctrl.canDelete = true;
                ctrl.selectAllChecked = true;
                return ctrl.refreshList();
            });
            it('should set checked to false on all sections and children', function () {
                expect(ctrl.sections.length).toEqual(1);
                expect(ctrl.sections[0].checked).toEqual(false);
                expect(ctrl.sections[0].items[0].checked).toEqual(false);
                expect(ctrl.sections[0].items[1].checked).toEqual(false);
            });
            it('should uncheck select all', function () {
                expect(ctrl.selectAllChecked).toBeFalsy();
            });
            it('should disable Move To button', function () {
                expect(ctrl.canMove).toBeFalsy();
            });
            it('should disable delete button', function () {
                expect(ctrl.canDelete).toBeFalsy();
            });
            it('should have active filters', function () {
                expect(ctrl.hasFilters).toBeTruthy();
            });
            describe('when select all is checked', function () {
                beforeEach(function () {
                    ctrl.selectAllChecked = true;
                    ctrl.onSelectAllChanged();
                });
                it('should select all dashboards', function () {
                    expect(ctrl.sections[0].checked).toBeFalsy();
                    expect(ctrl.sections[0].items[0].checked).toBeTruthy();
                    expect(ctrl.sections[0].items[1].checked).toBeTruthy();
                });
                it('should enable Move To button', function () {
                    expect(ctrl.canMove).toBeTruthy();
                });
                it('should enable delete button', function () {
                    expect(ctrl.canDelete).toBeTruthy();
                });
                describe('when clearing filters', function () {
                    beforeEach(function () {
                        return ctrl.clearFilters();
                    });
                    it('should reset query filter', function () {
                        expect(ctrl.query.query).toEqual('');
                    });
                });
            });
        });
        describe('with tag filter', function () {
            beforeEach(function () {
                return ctrl.filterByTag('test');
            });
            it('should set tag filter', function () {
                expect(ctrl.sections.length).toEqual(1);
                expect(ctrl.query.tag[0]).toEqual('test');
            });
            it('should have active filters', function () {
                expect(ctrl.hasFilters).toBeTruthy();
            });
            describe('when clearing filters', function () {
                beforeEach(function () {
                    return ctrl.clearFilters();
                });
                it('should reset tag filter', function () {
                    expect(ctrl.query.tag.length).toEqual(0);
                });
            });
        });
        describe('with starred filter', function () {
            beforeEach(function () {
                var yesOption = ctrl.starredFilterOptions[1];
                ctrl.selectedStarredFilter = yesOption;
                return ctrl.onStarredFilterChange();
            });
            it('should set starred filter', function () {
                expect(ctrl.sections.length).toEqual(1);
                expect(ctrl.query.starred).toEqual(true);
            });
            it('should have active filters', function () {
                expect(ctrl.hasFilters).toBeTruthy();
            });
            describe('when clearing filters', function () {
                beforeEach(function () {
                    return ctrl.clearFilters();
                });
                it('should reset starred filter', function () {
                    expect(ctrl.query.starred).toEqual(false);
                });
            });
        });
    });
    describe('when selecting dashboards', function () {
        var ctrl;
        beforeEach(function () {
            ctrl = createCtrlWithStubs([]);
        });
        describe('and no dashboards are selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        items: [{ id: 2, checked: false }],
                        checked: false,
                    }),
                    mockSection({
                        id: 0,
                        items: [{ id: 3, checked: false }],
                        checked: false,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should disable Move To button', function () {
                expect(ctrl.canMove).toBeFalsy();
            });
            it('should disable delete button', function () {
                expect(ctrl.canDelete).toBeFalsy();
            });
            describe('when select all is checked', function () {
                beforeEach(function () {
                    ctrl.selectAllChecked = true;
                    ctrl.onSelectAllChanged();
                });
                it('should select all folders and dashboards', function () {
                    expect(ctrl.sections[0].checked).toBeTruthy();
                    expect(ctrl.sections[0].items[0].checked).toBeTruthy();
                    expect(ctrl.sections[1].checked).toBeTruthy();
                    expect(ctrl.sections[1].items[0].checked).toBeTruthy();
                });
                it('should enable Move To button', function () {
                    expect(ctrl.canMove).toBeTruthy();
                });
                it('should enable delete button', function () {
                    expect(ctrl.canDelete).toBeTruthy();
                });
            });
        });
        describe('and all folders and dashboards are selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        items: [{ id: 2, checked: true }],
                        checked: true,
                    }),
                    mockSection({
                        id: 0,
                        items: [{ id: 3, checked: true }],
                        checked: true,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should enable Move To button', function () {
                expect(ctrl.canMove).toBeTruthy();
            });
            it('should enable delete button', function () {
                expect(ctrl.canDelete).toBeTruthy();
            });
            describe('when select all is unchecked', function () {
                beforeEach(function () {
                    ctrl.selectAllChecked = false;
                    ctrl.onSelectAllChanged();
                });
                it('should uncheck all checked folders and dashboards', function () {
                    expect(ctrl.sections[0].checked).toBeFalsy();
                    expect(ctrl.sections[0].items[0].checked).toBeFalsy();
                    expect(ctrl.sections[1].checked).toBeFalsy();
                    expect(ctrl.sections[1].items[0].checked).toBeFalsy();
                });
                it('should disable Move To button', function () {
                    expect(ctrl.canMove).toBeFalsy();
                });
                it('should disable delete button', function () {
                    expect(ctrl.canDelete).toBeFalsy();
                });
            });
        });
        describe('and one dashboard in root is selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        title: 'folder',
                        items: [{ id: 2, checked: false }],
                        checked: false,
                    }),
                    mockSection({
                        id: 0,
                        title: 'General',
                        items: [{ id: 3, checked: true }],
                        checked: false,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should enable Move To button', function () {
                expect(ctrl.canMove).toBeTruthy();
            });
            it('should enable delete button', function () {
                expect(ctrl.canDelete).toBeTruthy();
            });
        });
        describe('and one child dashboard is selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        title: 'folder',
                        items: [{ id: 2, checked: true }],
                        checked: false,
                    }),
                    mockSection({
                        id: 0,
                        title: 'General',
                        items: [{ id: 3, checked: false }],
                        checked: false,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should enable Move To button', function () {
                expect(ctrl.canMove).toBeTruthy();
            });
            it('should enable delete button', function () {
                expect(ctrl.canDelete).toBeTruthy();
            });
        });
        describe('and one child dashboard and one dashboard is selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        title: 'folder',
                        items: [{ id: 2, checked: true }],
                        checked: false,
                    }),
                    mockSection({
                        id: 0,
                        title: 'General',
                        items: [{ id: 3, checked: true }],
                        checked: false,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should enable Move To button', function () {
                expect(ctrl.canMove).toBeTruthy();
            });
            it('should enable delete button', function () {
                expect(ctrl.canDelete).toBeTruthy();
            });
        });
        describe('and one child dashboard and one folder is selected', function () {
            beforeEach(function () {
                ctrl.sections = [
                    mockSection({
                        id: 1,
                        title: 'folder',
                        items: [{ id: 2, checked: false }],
                        checked: true,
                    }),
                    mockSection({
                        id: 3,
                        title: 'folder',
                        items: [{ id: 4, checked: true }],
                        checked: false,
                    }),
                    mockSection({
                        id: 0,
                        title: 'General',
                        items: [{ id: 3, checked: false }],
                        checked: false,
                    }),
                ];
                ctrl.selectionChanged();
            });
            it('should enable Move To button', function () {
                expect(ctrl.canMove).toBeTruthy();
            });
            it('should enable delete button', function () {
                expect(ctrl.canDelete).toBeTruthy();
            });
        });
    });
    describe('when deleting dashboards', function () {
        var toBeDeleted;
        beforeEach(function () {
            ctrl = createCtrlWithStubs([]);
            ctrl.sections = [
                mockSection({
                    id: 1,
                    uid: 'folder',
                    title: 'folder',
                    items: [{ id: 2, checked: true, uid: 'folder-dash' }],
                    checked: true,
                }),
                mockSection({
                    id: 3,
                    title: 'folder-2',
                    items: [{ id: 3, checked: true, uid: 'folder-2-dash' }],
                    checked: false,
                    uid: 'folder-2',
                }),
                mockSection({
                    id: 0,
                    title: 'General',
                    items: [{ id: 3, checked: true, uid: 'root-dash' }],
                    checked: true,
                }),
            ];
            toBeDeleted = ctrl.getFoldersAndDashboardsToDelete();
        });
        it('should return 1 folder', function () {
            expect(toBeDeleted.folderUids.length).toEqual(1);
        });
        it('should return 2 dashboards', function () {
            expect(toBeDeleted.dashboardUids.length).toEqual(2);
        });
        it('should filter out children if parent is checked', function () {
            expect(toBeDeleted.folderUids[0]).toEqual('folder');
        });
        it('should not filter out children if parent not is checked', function () {
            expect(toBeDeleted.dashboardUids[0]).toEqual('folder-2-dash');
        });
        it('should not filter out children if parent is checked and root', function () {
            expect(toBeDeleted.dashboardUids[1]).toEqual('root-dash');
        });
    });
    describe('when moving dashboards', function () {
        beforeEach(function () {
            ctrl = createCtrlWithStubs([]);
            ctrl.sections = [
                mockSection({
                    id: 1,
                    title: 'folder',
                    items: [{ id: 2, checked: true, uid: 'dash' }],
                    checked: false,
                    uid: 'folder',
                }),
                mockSection({
                    id: 0,
                    title: 'General',
                    items: [{ id: 3, checked: true, uid: 'dash-2' }],
                    checked: false,
                }),
            ];
        });
        it('should get selected dashboards', function () {
            var toBeMove = ctrl.getDashboardsToMove();
            expect(toBeMove.length).toEqual(2);
            expect(toBeMove[0]).toEqual('dash');
            expect(toBeMove[1]).toEqual('dash-2');
        });
    });
});
function createCtrlWithStubs(searchResponse, tags) {
    var searchSrvStub = {
        search: function (options) {
            return q.resolve(searchResponse);
        },
        getDashboardTags: function () {
            return q.resolve(tags || []);
        },
    };
    return new ManageDashboardsCtrl({}, { getNav: function () { } }, searchSrvStub, { isEditor: true });
}
//# sourceMappingURL=manage_dashboards.test.js.map