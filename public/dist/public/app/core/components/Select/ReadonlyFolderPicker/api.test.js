import { __awaiter, __generator } from "tslib";
import * as api from '../../../../features/manage-dashboards/state/actions';
import { getFolderAsOption, getFoldersAsOptions } from './api';
import { PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER } from './ReadonlyFolderPicker';
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
function getTestContext(searchHits, folderById) {
    if (searchHits === void 0) { searchHits = []; }
    if (folderById === void 0) { folderById = { id: 1, title: 'Folder 1' }; }
    jest.clearAllMocks();
    var searchFoldersSpy = jest.spyOn(api, 'searchFolders').mockResolvedValue(searchHits);
    var getFolderByIdSpy = jest.spyOn(api, 'getFolderById').mockResolvedValue(folderById);
    return { searchFoldersSpy: searchFoldersSpy, getFolderByIdSpy: getFolderByIdSpy };
}
describe('getFoldersAsOptions', function () {
    describe('when called without permissionLevel and query', function () {
        it('then the correct defaults are passed to the api', function () { return __awaiter(void 0, void 0, void 0, function () {
            var searchFoldersSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        searchFoldersSpy = getTestContext().searchFoldersSpy;
                        return [4 /*yield*/, getFoldersAsOptions({ query: '' })];
                    case 1:
                        _a.sent();
                        expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
                        expect(searchFoldersSpy).toHaveBeenCalledWith('', 'View');
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and extra folders are passed', function () {
            it('then extra folders should all appear first in the result', function () { return __awaiter(void 0, void 0, void 0, function () {
                var args, searchHits, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = { query: '', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                            searchHits = [{ id: 1, title: 'Folder 1' }];
                            getTestContext(searchHits);
                            return [4 /*yield*/, getFoldersAsOptions(args)];
                        case 1:
                            result = _a.sent();
                            expect(result).toEqual([
                                { value: { id: undefined, title: 'All' }, label: 'All' },
                                { value: { id: 0, title: 'General' }, label: 'General' },
                                { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
                            ]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when called with permissionLevel and query', function () {
        it('then the correct values are passed to the api', function () { return __awaiter(void 0, void 0, void 0, function () {
            var searchFoldersSpy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        searchFoldersSpy = getTestContext().searchFoldersSpy;
                        return [4 /*yield*/, getFoldersAsOptions({ query: 'Folder1', permissionLevel: PermissionLevelString.Edit })];
                    case 1:
                        _a.sent();
                        expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
                        expect(searchFoldersSpy).toHaveBeenCalledWith('Folder1', 'Edit');
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and extra folders are passed and extra folders contain query', function () {
            it('then correct extra folders should all appear first in the result', function () { return __awaiter(void 0, void 0, void 0, function () {
                var args, searchHits, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = { query: 'er', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                            searchHits = [{ id: 1, title: 'Folder 1' }];
                            getTestContext(searchHits);
                            return [4 /*yield*/, getFoldersAsOptions(args)];
                        case 1:
                            result = _a.sent();
                            expect(result).toEqual([
                                { value: { id: 0, title: 'General' }, label: 'General' },
                                { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
                            ]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and extra folders are passed and extra folders do not contain query', function () {
            it('then no extra folders should appear first in the result', function () { return __awaiter(void 0, void 0, void 0, function () {
                var args, searchHits, result;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = { query: '1', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                            searchHits = [{ id: 1, title: 'Folder 1' }];
                            getTestContext(searchHits);
                            return [4 /*yield*/, getFoldersAsOptions(args)];
                        case 1:
                            result = _a.sent();
                            expect(result).toEqual([{ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' }]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
describe('getFolderAsOption', function () {
    describe('when called with undefined', function () {
        it('then it should return undefined', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolderByIdSpy, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolderByIdSpy = getTestContext().getFolderByIdSpy;
                        return [4 /*yield*/, getFolderAsOption(undefined)];
                    case 1:
                        result = _a.sent();
                        expect(result).toBeUndefined();
                        expect(getFolderByIdSpy).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a folder id that does not exist', function () {
        silenceConsoleOutput();
        it('then it should return undefined', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolderByIdSpy, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolderByIdSpy = getTestContext().getFolderByIdSpy;
                        getFolderByIdSpy.mockRejectedValue('Not found');
                        return [4 /*yield*/, getFolderAsOption(-1)];
                    case 1:
                        result = _a.sent();
                        expect(result).toBeUndefined();
                        expect(getFolderByIdSpy).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with a folder id that exist', function () {
        it('then it should return a SelectableValue of FolderInfo', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolderByIdSpy, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolderByIdSpy = getTestContext().getFolderByIdSpy;
                        return [4 /*yield*/, getFolderAsOption(1)];
                    case 1:
                        result = _a.sent();
                        expect(result).toEqual({ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' });
                        expect(getFolderByIdSpy).toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=api.test.js.map