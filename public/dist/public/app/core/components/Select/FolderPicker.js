import { __awaiter, __extends, __generator } from "tslib";
import React, { PureComponent } from 'react';
import { debounce } from 'lodash';
import { AsyncSelect } from '@grafana/ui';
import { AppEvents } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import appEvents from '../../app_events';
import { contextSrv } from 'app/core/services/context_srv';
import { createFolder, getFolderById, searchFolders } from 'app/features/manage-dashboards/state/actions';
import { PermissionLevelString } from '../../../types';
var FolderPicker = /** @class */ (function (_super) {
    __extends(FolderPicker, _super);
    function FolderPicker(props) {
        var _this = _super.call(this, props) || this;
        _this.componentDidMount = function () { return __awaiter(_this, void 0, void 0, function () {
            var folder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.props.skipInitialLoad) return [3 /*break*/, 2];
                        return [4 /*yield*/, getInitialValues({
                                getFolder: getFolderById,
                                folderId: this.props.initialFolderId,
                                folderName: this.props.initialTitle,
                            })];
                    case 1:
                        folder = _a.sent();
                        this.setState({ folder: folder });
                        return [2 /*return*/];
                    case 2: return [4 /*yield*/, this.loadInitialValue()];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); };
        _this.getOptions = function (query) { return __awaiter(_this, void 0, void 0, function () {
            var _a, rootName, enableReset, initialTitle, permissionLevel, initialFolderId, showRoot, searchHits, options;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, rootName = _a.rootName, enableReset = _a.enableReset, initialTitle = _a.initialTitle, permissionLevel = _a.permissionLevel, initialFolderId = _a.initialFolderId, showRoot = _a.showRoot;
                        return [4 /*yield*/, searchFolders(query, permissionLevel)];
                    case 1:
                        searchHits = _b.sent();
                        options = searchHits.map(function (hit) { return ({ label: hit.title, value: hit.id }); });
                        if (contextSrv.isEditor && (rootName === null || rootName === void 0 ? void 0 : rootName.toLowerCase().startsWith(query.toLowerCase())) && showRoot) {
                            options.unshift({ label: rootName, value: 0 });
                        }
                        if (enableReset &&
                            query === '' &&
                            initialTitle !== '' &&
                            !options.find(function (option) { return option.label === initialTitle; })) {
                            options.unshift({ label: initialTitle, value: initialFolderId });
                        }
                        return [2 /*return*/, options];
                }
            });
        }); };
        _this.onFolderChange = function (newFolder) {
            if (!newFolder) {
                newFolder = { value: 0, label: _this.props.rootName };
            }
            _this.setState({
                folder: newFolder,
            }, function () { return _this.props.onChange({ id: newFolder.value, title: newFolder.label }); });
        };
        _this.createNewFolder = function (folderName) { return __awaiter(_this, void 0, void 0, function () {
            var newFolder, folder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, createFolder({ title: folderName })];
                    case 1:
                        newFolder = _a.sent();
                        folder = { value: -1, label: 'Not created' };
                        if (!(newFolder.id > -1)) return [3 /*break*/, 3];
                        appEvents.emit(AppEvents.alertSuccess, ['Folder Created', 'OK']);
                        folder = { value: newFolder.id, label: newFolder.title };
                        return [4 /*yield*/, this.onFolderChange(folder)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        appEvents.emit(AppEvents.alertError, ['Folder could not be created']);
                        _a.label = 4;
                    case 4: return [2 /*return*/, folder];
                }
            });
        }); };
        _this.loadInitialValue = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, initialTitle, rootName, initialFolderId, enableReset, dashboardId, resetFolder, rootFolder, options, folder, isPersistedDashBoard;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this.props, initialTitle = _a.initialTitle, rootName = _a.rootName, initialFolderId = _a.initialFolderId, enableReset = _a.enableReset, dashboardId = _a.dashboardId;
                        resetFolder = { label: initialTitle, value: undefined };
                        rootFolder = { label: rootName, value: 0 };
                        return [4 /*yield*/, this.getOptions('')];
                    case 1:
                        options = _b.sent();
                        folder = null;
                        if (initialFolderId !== undefined && initialFolderId !== null && initialFolderId > -1) {
                            folder = options.find(function (option) { return option.value === initialFolderId; }) || null;
                        }
                        else if (enableReset && initialTitle) {
                            folder = resetFolder;
                        }
                        else if (initialFolderId) {
                            folder = options.find(function (option) { return option.id === initialFolderId; }) || null;
                        }
                        if (!folder && !this.props.allowEmpty) {
                            if (contextSrv.isEditor) {
                                folder = rootFolder;
                            }
                            else {
                                isPersistedDashBoard = !!dashboardId;
                                if (isPersistedDashBoard) {
                                    folder = resetFolder;
                                }
                                else {
                                    folder = options.length > 0 ? options[0] : resetFolder;
                                }
                            }
                        }
                        this.setState({
                            folder: folder,
                        }, function () {
                            // if this is not the same as our initial value notify parent
                            if (folder && folder.value !== initialFolderId) {
                                _this.props.onChange({ id: folder.value, title: folder.label });
                            }
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        _this.state = {
            folder: null,
        };
        _this.debouncedSearch = debounce(_this.getOptions, 300, {
            leading: true,
            trailing: true,
        });
        return _this;
    }
    FolderPicker.prototype.render = function () {
        var folder = this.state.folder;
        var _a = this.props, enableCreateNew = _a.enableCreateNew, inputId = _a.inputId;
        return (React.createElement("div", { "aria-label": selectors.components.FolderPicker.container },
            React.createElement(AsyncSelect, { inputId: inputId, "aria-label": selectors.components.FolderPicker.input, loadingMessage: "Loading folders...", defaultOptions: true, defaultValue: folder, value: folder, allowCustomValue: enableCreateNew, loadOptions: this.debouncedSearch, onChange: this.onFolderChange, onCreateOption: this.createNewFolder, menuShouldPortal: true })));
    };
    FolderPicker.defaultProps = {
        rootName: 'General',
        enableReset: false,
        initialTitle: '',
        enableCreateNew: false,
        permissionLevel: PermissionLevelString.Edit,
        allowEmpty: false,
        showRoot: true,
    };
    return FolderPicker;
}(PureComponent));
export { FolderPicker };
export function getInitialValues(_a) {
    var folderName = _a.folderName, folderId = _a.folderId, getFolder = _a.getFolder;
    return __awaiter(this, void 0, void 0, function () {
        var folderDto;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (folderId === null || folderId === undefined || folderId < 0) {
                        throw new Error('folderId should to be greater or equal to zero.');
                    }
                    if (folderName) {
                        return [2 /*return*/, { label: folderName, value: folderId }];
                    }
                    return [4 /*yield*/, getFolder(folderId)];
                case 1:
                    folderDto = _b.sent();
                    return [2 /*return*/, { label: folderDto.title, value: folderId }];
            }
        });
    });
}
//# sourceMappingURL=FolderPicker.js.map