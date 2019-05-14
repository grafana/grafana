import * as tslib_1 from "tslib";
// @ts-ignore
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
var Query = /** @class */ (function () {
    function Query() {
    }
    return Query;
}());
var ManageDashboardsCtrl = /** @class */ (function () {
    /** @ngInject */
    function ManageDashboardsCtrl(backendSrv, navModelSrv, searchSrv, contextSrv) {
        var _this = this;
        this.backendSrv = backendSrv;
        this.searchSrv = searchSrv;
        this.contextSrv = contextSrv;
        this.selectAllChecked = false;
        // enable/disable actions depending on the folders or dashboards selected
        this.canDelete = false;
        this.canMove = false;
        // filter variables
        this.hasFilters = false;
        this.starredFilterOptions = [{ text: 'Filter by Starred', disabled: true }, { text: 'Yes' }, { text: 'No' }];
        // if user can add new folders and/or add new dashboards
        this.canSave = false;
        this.isEditor = this.contextSrv.isEditor;
        this.hasEditPermissionInFolders = this.contextSrv.hasEditPermissionInFolders;
        this.query = {
            query: '',
            mode: 'tree',
            tag: [],
            starred: false,
            skipRecent: true,
            skipStarred: true,
            folderIds: [],
        };
        if (this.folderId) {
            this.query.folderIds = [this.folderId];
        }
        this.selectedStarredFilter = this.starredFilterOptions[0];
        this.refreshList().then(function () {
            _this.initTagFilter();
        });
    }
    ManageDashboardsCtrl.prototype.refreshList = function () {
        var _this = this;
        return this.searchSrv
            .search(this.query)
            .then(function (result) {
            return _this.initDashboardList(result);
        })
            .then(function () {
            if (!_this.folderUid) {
                return;
            }
            return _this.backendSrv.getFolderByUid(_this.folderUid).then(function (folder) {
                _this.canSave = folder.canSave;
                if (!_this.canSave) {
                    _this.hasEditPermissionInFolders = false;
                }
            });
        });
    };
    ManageDashboardsCtrl.prototype.initDashboardList = function (result) {
        var e_1, _a, e_2, _b;
        this.canMove = false;
        this.canDelete = false;
        this.selectAllChecked = false;
        this.hasFilters = this.query.query.length > 0 || this.query.tag.length > 0 || this.query.starred;
        if (!result) {
            this.sections = [];
            return;
        }
        this.sections = result;
        try {
            for (var _c = tslib_1.__values(this.sections), _d = _c.next(); !_d.done; _d = _c.next()) {
                var section = _d.value;
                section.checked = false;
                try {
                    for (var _e = tslib_1.__values(section.items), _f = _e.next(); !_f.done; _f = _e.next()) {
                        var dashboard = _f.value;
                        dashboard.checked = false;
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_1) throw e_1.error; }
        }
        if (this.folderId && this.sections.length > 0) {
            this.sections[0].hideHeader = true;
        }
    };
    ManageDashboardsCtrl.prototype.selectionChanged = function () {
        var e_3, _a;
        var selectedDashboards = 0;
        try {
            for (var _b = tslib_1.__values(this.sections), _c = _b.next(); !_c.done; _c = _b.next()) {
                var section = _c.value;
                selectedDashboards += _.filter(section.items, { checked: true }).length;
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_3) throw e_3.error; }
        }
        var selectedFolders = _.filter(this.sections, { checked: true }).length;
        this.canMove = selectedDashboards > 0;
        this.canDelete = selectedDashboards > 0 || selectedFolders > 0;
    };
    ManageDashboardsCtrl.prototype.getFoldersAndDashboardsToDelete = function () {
        var e_4, _a, _b;
        var selectedDashboards = {
            folderUids: [],
            dashboardUids: [],
        };
        try {
            for (var _c = tslib_1.__values(this.sections), _d = _c.next(); !_d.done; _d = _c.next()) {
                var section = _d.value;
                if (section.checked && section.id !== 0) {
                    selectedDashboards.folderUids.push(section.uid);
                }
                else {
                    var selected = _.filter(section.items, { checked: true });
                    (_b = selectedDashboards.dashboardUids).push.apply(_b, tslib_1.__spread(_.map(selected, 'uid')));
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return selectedDashboards;
    };
    ManageDashboardsCtrl.prototype.getFolderIds = function (sections) {
        var e_5, _a;
        var ids = [];
        try {
            for (var sections_1 = tslib_1.__values(sections), sections_1_1 = sections_1.next(); !sections_1_1.done; sections_1_1 = sections_1.next()) {
                var s = sections_1_1.value;
                if (s.checked) {
                    ids.push(s.id);
                }
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (sections_1_1 && !sections_1_1.done && (_a = sections_1.return)) _a.call(sections_1);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return ids;
    };
    ManageDashboardsCtrl.prototype.delete = function () {
        var _this = this;
        var data = this.getFoldersAndDashboardsToDelete();
        var folderCount = data.folderUids.length;
        var dashCount = data.dashboardUids.length;
        var text = 'Do you want to delete the ';
        var text2;
        if (folderCount > 0 && dashCount > 0) {
            text += "selected folder" + (folderCount === 1 ? '' : 's') + " and dashboard" + (dashCount === 1 ? '' : 's') + "?";
            text2 = "All dashboards of the selected folder" + (folderCount === 1 ? '' : 's') + " will also be deleted";
        }
        else if (folderCount > 0) {
            text += "selected folder" + (folderCount === 1 ? '' : 's') + " and all its dashboards?";
        }
        else {
            text += "selected dashboard" + (dashCount === 1 ? '' : 's') + "?";
        }
        appEvents.emit('confirm-modal', {
            title: 'Delete',
            text: text,
            text2: text2,
            icon: 'fa-trash',
            yesText: 'Delete',
            onConfirm: function () {
                _this.deleteFoldersAndDashboards(data.folderUids, data.dashboardUids);
            },
        });
    };
    ManageDashboardsCtrl.prototype.deleteFoldersAndDashboards = function (folderUids, dashboardUids) {
        var _this = this;
        this.backendSrv.deleteFoldersAndDashboards(folderUids, dashboardUids).then(function () {
            _this.refreshList();
        });
    };
    ManageDashboardsCtrl.prototype.getDashboardsToMove = function () {
        var e_6, _a;
        var selectedDashboards = [];
        try {
            for (var _b = tslib_1.__values(this.sections), _c = _b.next(); !_c.done; _c = _b.next()) {
                var section = _c.value;
                var selected = _.filter(section.items, { checked: true });
                selectedDashboards.push.apply(selectedDashboards, tslib_1.__spread(_.map(selected, 'uid')));
            }
        }
        catch (e_6_1) { e_6 = { error: e_6_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_6) throw e_6.error; }
        }
        return selectedDashboards;
    };
    ManageDashboardsCtrl.prototype.moveTo = function () {
        var selectedDashboards = this.getDashboardsToMove();
        var template = '<move-to-folder-modal dismiss="dismiss()" ' +
            'dashboards="model.dashboards" after-save="model.afterSave()">' +
            '</move-to-folder-modal>';
        appEvents.emit('show-modal', {
            templateHtml: template,
            modalClass: 'modal--narrow',
            model: {
                dashboards: selectedDashboards,
                afterSave: this.refreshList.bind(this),
            },
        });
    };
    ManageDashboardsCtrl.prototype.initTagFilter = function () {
        var _this = this;
        return this.searchSrv.getDashboardTags().then(function (results) {
            _this.tagFilterOptions = [{ term: 'Filter By Tag', disabled: true }].concat(results);
            _this.selectedTagFilter = _this.tagFilterOptions[0];
        });
    };
    ManageDashboardsCtrl.prototype.filterByTag = function (tag) {
        if (_.indexOf(this.query.tag, tag) === -1) {
            this.query.tag.push(tag);
        }
        return this.refreshList();
    };
    ManageDashboardsCtrl.prototype.onQueryChange = function () {
        return this.refreshList();
    };
    ManageDashboardsCtrl.prototype.onTagFilterChange = function () {
        var res = this.filterByTag(this.selectedTagFilter.term);
        this.selectedTagFilter = this.tagFilterOptions[0];
        return res;
    };
    ManageDashboardsCtrl.prototype.removeTag = function (tag, evt) {
        this.query.tag = _.without(this.query.tag, tag);
        this.refreshList();
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
    };
    ManageDashboardsCtrl.prototype.removeStarred = function () {
        this.query.starred = false;
        return this.refreshList();
    };
    ManageDashboardsCtrl.prototype.onStarredFilterChange = function () {
        this.query.starred = this.selectedStarredFilter.text === 'Yes';
        this.selectedStarredFilter = this.starredFilterOptions[0];
        return this.refreshList();
    };
    ManageDashboardsCtrl.prototype.onSelectAllChanged = function () {
        var _this = this;
        var e_7, _a;
        try {
            for (var _b = tslib_1.__values(this.sections), _c = _b.next(); !_c.done; _c = _b.next()) {
                var section = _c.value;
                if (!section.hideHeader) {
                    section.checked = this.selectAllChecked;
                }
                section.items = _.map(section.items, function (item) {
                    item.checked = _this.selectAllChecked;
                    return item;
                });
            }
        }
        catch (e_7_1) { e_7 = { error: e_7_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_7) throw e_7.error; }
        }
        this.selectionChanged();
    };
    ManageDashboardsCtrl.prototype.clearFilters = function () {
        this.query.query = '';
        this.query.tag = [];
        this.query.starred = false;
        this.refreshList();
    };
    ManageDashboardsCtrl.prototype.createDashboardUrl = function () {
        var url = 'dashboard/new';
        if (this.folderId) {
            url += "?folderId=" + this.folderId;
        }
        return url;
    };
    ManageDashboardsCtrl.prototype.importDashboardUrl = function () {
        var url = 'dashboard/import';
        if (this.folderId) {
            url += "?folderId=" + this.folderId;
        }
        return url;
    };
    return ManageDashboardsCtrl;
}());
export { ManageDashboardsCtrl };
export function manageDashboardsDirective() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/core/components/manage_dashboards/manage_dashboards.html',
        controller: ManageDashboardsCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            folderId: '=',
            folderUid: '=',
        },
    };
}
coreModule.directive('manageDashboards', manageDashboardsDirective);
//# sourceMappingURL=manage_dashboards.js.map