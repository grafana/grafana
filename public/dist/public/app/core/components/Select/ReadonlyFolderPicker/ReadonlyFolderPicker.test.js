import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { byTestId } from 'testing-library-selector';
import * as api from './api';
import { PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker } from './ReadonlyFolderPicker';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
var FOLDERS = [
    { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
    { value: { id: 1, title: 'Test' }, label: 'Test' },
];
function getTestContext(propOverrides, folders, folder) {
    if (propOverrides === void 0) { propOverrides = {}; }
    if (folders === void 0) { folders = []; }
    if (folder === void 0) { folder = undefined; }
    return __awaiter(this, void 0, void 0, function () {
        var selectors, getFoldersAsOptionsSpy, getFolderAsOptionSpy, props;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.clearAllMocks();
                    selectors = {
                        container: byTestId(e2eSelectors.components.ReadonlyFolderPicker.container),
                    };
                    getFoldersAsOptionsSpy = jest.spyOn(api, 'getFoldersAsOptions').mockResolvedValue(folders);
                    getFolderAsOptionSpy = jest.spyOn(api, 'getFolderAsOption').mockResolvedValue(folder);
                    props = {
                        onChange: jest.fn(),
                    };
                    Object.assign(props, propOverrides);
                    render(React.createElement(ReadonlyFolderPicker, __assign({}, props)));
                    return [4 /*yield*/, waitFor(function () { return expect(getFoldersAsOptionsSpy).toHaveBeenCalledTimes(1); })];
                case 1:
                    _a.sent();
                    return [2 /*return*/, { getFoldersAsOptionsSpy: getFoldersAsOptionsSpy, getFolderAsOptionSpy: getFolderAsOptionSpy, selectors: selectors }];
            }
        });
    });
}
describe('ReadonlyFolderPicker', function () {
    describe('when there are no folders', function () {
        it('then the no folder should be selected and Choose should appear', function () { return __awaiter(void 0, void 0, void 0, function () {
            var selectors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        selectors = (_a.sent()).selectors;
                        expect(within(selectors.container.get()).getByText('Choose')).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when permissionLevel is set', function () {
        it('then permissionLevel is passed correctly to getFoldersAsOptions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFoldersAsOptionsSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ permissionLevel: PermissionLevelString.Edit })];
                    case 1:
                        getFoldersAsOptionsSpy = (_a.sent()).getFoldersAsOptionsSpy;
                        expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                            query: '',
                            permissionLevel: 'Edit',
                            extraFolders: [],
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when extraFolders is set', function () {
        it('then extraFolders is passed correctly to getFoldersAsOptions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFoldersAsOptionsSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ extraFolders: [ALL_FOLDER] })];
                    case 1:
                        getFoldersAsOptionsSpy = (_a.sent()).getFoldersAsOptionsSpy;
                        expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                            query: '',
                            permissionLevel: 'View',
                            extraFolders: [{ id: undefined, title: 'All' }],
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when entering a query in the input', function () {
        it('then query is passed correctly to getFoldersAsOptions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a, getFoldersAsOptionsSpy, selectors;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _a = _b.sent(), getFoldersAsOptionsSpy = _a.getFoldersAsOptionsSpy, selectors = _a.selectors;
                        expect(within(selectors.container.get()).getByRole('textbox')).toBeInTheDocument();
                        getFoldersAsOptionsSpy.mockClear();
                        userEvent.type(within(selectors.container.get()).getByRole('textbox'), 'A');
                        return [4 /*yield*/, waitFor(function () { return expect(getFoldersAsOptionsSpy).toHaveBeenCalledTimes(1); })];
                    case 2:
                        _b.sent();
                        expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                            query: 'A',
                            permissionLevel: 'View',
                            extraFolders: [],
                        });
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when there are folders', function () {
        it('then the first folder in all folders should be selected', function () { return __awaiter(void 0, void 0, void 0, function () {
            var selectors;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({}, FOLDERS)];
                    case 1:
                        selectors = (_a.sent()).selectors;
                        expect(within(selectors.container.get()).getByText('General')).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and initialFolderId is passed in props and it matches an existing folder', function () {
            it('then the folder with an id equal to initialFolderId should be selected', function () { return __awaiter(void 0, void 0, void 0, function () {
                var selectors;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ initialFolderId: 1 }, FOLDERS)];
                        case 1:
                            selectors = (_a.sent()).selectors;
                            expect(within(selectors.container.get()).getByText('Test')).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and initialFolderId is passed in props and it does not match an existing folder from search api', function () {
            it('then getFolderAsOption should be called and correct folder should be selected', function () { return __awaiter(void 0, void 0, void 0, function () {
                var folderById, _a, selectors, getFolderAsOptionSpy;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            folderById = {
                                value: { id: 50000, title: 'Outside api search' },
                                label: 'Outside api search',
                            };
                            return [4 /*yield*/, getTestContext({ initialFolderId: 50000 }, FOLDERS, folderById)];
                        case 1:
                            _a = _b.sent(), selectors = _a.selectors, getFolderAsOptionSpy = _a.getFolderAsOptionSpy;
                            expect(within(selectors.container.get()).getByText('Outside api search')).toBeInTheDocument();
                            expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
                            expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and initialFolderId is passed in props and folder does not exist', function () {
            it('then getFolderAsOption should be called and the first folder should be selected instead', function () { return __awaiter(void 0, void 0, void 0, function () {
                var _a, selectors, getFolderAsOptionSpy;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, getTestContext({ initialFolderId: 50000 }, FOLDERS, undefined)];
                        case 1:
                            _a = _b.sent(), selectors = _a.selectors, getFolderAsOptionSpy = _a.getFolderAsOptionSpy;
                            expect(within(selectors.container.get()).getByText('General')).toBeInTheDocument();
                            expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
                            expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=ReadonlyFolderPicker.test.js.map