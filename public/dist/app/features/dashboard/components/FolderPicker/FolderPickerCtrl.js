import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
var FolderPickerCtrl = /** @class */ (function () {
    /** @ngInject */
    function FolderPickerCtrl(backendSrv, validationSrv, contextSrv) {
        this.backendSrv = backendSrv;
        this.validationSrv = validationSrv;
        this.contextSrv = contextSrv;
        this.rootName = 'General';
        this.isEditor = this.contextSrv.isEditor;
        if (!this.labelClass) {
            this.labelClass = 'width-7';
        }
        this.loadInitialValue();
    }
    FolderPickerCtrl.prototype.getOptions = function (query) {
        var _this = this;
        var params = {
            query: query,
            type: 'dash-folder',
            permission: 'Edit',
        };
        return this.backendSrv.get('api/search', params).then(function (result) {
            if (_this.isEditor &&
                (query === '' ||
                    query.toLowerCase() === 'g' ||
                    query.toLowerCase() === 'ge' ||
                    query.toLowerCase() === 'gen' ||
                    query.toLowerCase() === 'gene' ||
                    query.toLowerCase() === 'gener' ||
                    query.toLowerCase() === 'genera' ||
                    query.toLowerCase() === 'general')) {
                result.unshift({ title: _this.rootName, id: 0 });
            }
            if (_this.isEditor && _this.enableCreateNew && query === '') {
                result.unshift({ title: '-- New Folder --', id: -1 });
            }
            if (_this.enableReset && query === '' && _this.initialTitle !== '') {
                result.unshift({ title: _this.initialTitle, id: null });
            }
            return _.map(result, function (item) {
                return { text: item.title, value: item.id };
            });
        });
    };
    FolderPickerCtrl.prototype.onFolderChange = function (option) {
        if (!option) {
            option = { value: 0, text: this.rootName };
        }
        else if (option.value === -1) {
            this.createNewFolder = true;
            this.enterFolderCreation();
            return;
        }
        this.onChange({ $folder: { id: option.value, title: option.text } });
    };
    FolderPickerCtrl.prototype.newFolderNameChanged = function () {
        var _this = this;
        this.newFolderNameTouched = true;
        this.validationSrv
            .validateNewFolderName(this.newFolderName)
            .then(function () {
            _this.hasValidationError = false;
        })
            .catch(function (err) {
            _this.hasValidationError = true;
            _this.validationError = err.message;
        });
    };
    FolderPickerCtrl.prototype.createFolder = function (evt) {
        var _this = this;
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
        return this.backendSrv.createFolder({ title: this.newFolderName }).then(function (result) {
            appEvents.emit('alert-success', ['Folder Created', 'OK']);
            _this.closeCreateFolder();
            _this.folder = { text: result.title, value: result.id };
            _this.onFolderChange(_this.folder);
        });
    };
    FolderPickerCtrl.prototype.cancelCreateFolder = function (evt) {
        if (evt) {
            evt.stopPropagation();
            evt.preventDefault();
        }
        this.closeCreateFolder();
        this.loadInitialValue();
    };
    FolderPickerCtrl.prototype.closeCreateFolder = function () {
        this.exitFolderCreation();
        this.createNewFolder = false;
        this.hasValidationError = false;
        this.validationError = null;
        this.newFolderName = '';
        this.newFolderNameTouched = false;
    };
    FolderPickerCtrl.prototype.loadInitialValue = function () {
        var _this = this;
        var resetFolder = { text: this.initialTitle, value: null };
        var rootFolder = { text: this.rootName, value: 0 };
        this.getOptions('').then(function (result) {
            var folder;
            if (_this.initialFolderId) {
                folder = _.find(result, { value: _this.initialFolderId });
            }
            else if (_this.enableReset && _this.initialTitle && _this.initialFolderId === null) {
                folder = resetFolder;
            }
            if (!folder) {
                if (_this.isEditor) {
                    folder = rootFolder;
                }
                else {
                    // We shouldn't assign a random folder without the user actively choosing it on a persisted dashboard
                    var isPersistedDashBoard = _this.dashboardId ? true : false;
                    if (isPersistedDashBoard) {
                        folder = resetFolder;
                    }
                    else {
                        folder = result.length > 0 ? result[0] : resetFolder;
                    }
                }
            }
            _this.folder = folder;
            // if this is not the same as our initial value notify parent
            if (_this.folder.value !== _this.initialFolderId) {
                _this.onChange({ $folder: { id: _this.folder.value, title: _this.folder.text } });
            }
        });
    };
    return FolderPickerCtrl;
}());
export { FolderPickerCtrl };
export function folderPicker() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/FolderPicker/template.html',
        controller: FolderPickerCtrl,
        bindToController: true,
        controllerAs: 'ctrl',
        scope: {
            initialTitle: '<',
            initialFolderId: '<',
            labelClass: '@',
            rootName: '@',
            onChange: '&',
            onCreateFolder: '&',
            enterFolderCreation: '&',
            exitFolderCreation: '&',
            enableCreateNew: '@',
            enableReset: '@',
            dashboardId: '<?',
        },
    };
}
coreModule.directive('folderPicker', folderPicker);
//# sourceMappingURL=FolderPickerCtrl.js.map