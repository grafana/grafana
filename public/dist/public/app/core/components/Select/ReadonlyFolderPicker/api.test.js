import { __awaiter } from "tslib";
import { silenceConsoleOutput } from '../../../../../test/core/utils/silenceConsoleOutput';
import * as api from '../../../../features/manage-dashboards/state/actions';
import { PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER } from './ReadonlyFolderPicker';
import { getFolderAsOption, getFoldersAsOptions } from './api';
function getTestContext(searchHits = [], folderById = { id: 1, title: 'Folder 1' }) {
    jest.clearAllMocks();
    const searchFoldersSpy = jest.spyOn(api, 'searchFolders').mockResolvedValue(searchHits);
    const getFolderByIdSpy = jest.spyOn(api, 'getFolderById').mockResolvedValue(folderById);
    return { searchFoldersSpy, getFolderByIdSpy };
}
describe('getFoldersAsOptions', () => {
    describe('when called without permissionLevel and query', () => {
        it('then the correct defaults are passed to the api', () => __awaiter(void 0, void 0, void 0, function* () {
            const { searchFoldersSpy } = getTestContext();
            yield getFoldersAsOptions({ query: '' });
            expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
            expect(searchFoldersSpy).toHaveBeenCalledWith('', 'View');
        }));
        describe('and extra folders are passed', () => {
            it('then extra folders should all appear first in the result', () => __awaiter(void 0, void 0, void 0, function* () {
                const args = { query: '', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                const searchHits = [{ id: 1, title: 'Folder 1' }];
                getTestContext(searchHits);
                const result = yield getFoldersAsOptions(args);
                expect(result).toEqual([
                    { value: { id: undefined, title: 'All' }, label: 'All' },
                    { value: { id: 0, title: 'General' }, label: 'General' },
                    { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
                ]);
            }));
        });
    });
    describe('when called with permissionLevel and query', () => {
        it('then the correct values are passed to the api', () => __awaiter(void 0, void 0, void 0, function* () {
            const { searchFoldersSpy } = getTestContext();
            yield getFoldersAsOptions({ query: 'Folder1', permissionLevel: PermissionLevelString.Edit });
            expect(searchFoldersSpy).toHaveBeenCalledTimes(1);
            expect(searchFoldersSpy).toHaveBeenCalledWith('Folder1', 'Edit');
        }));
        describe('and extra folders are passed and extra folders contain query', () => {
            it('then correct extra folders should all appear first in the result', () => __awaiter(void 0, void 0, void 0, function* () {
                const args = { query: 'er', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                const searchHits = [{ id: 1, title: 'Folder 1' }];
                getTestContext(searchHits);
                const result = yield getFoldersAsOptions(args);
                expect(result).toEqual([
                    { value: { id: 0, title: 'General' }, label: 'General' },
                    { value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' },
                ]);
            }));
        });
        describe('and extra folders are passed and extra folders do not contain query', () => {
            it('then no extra folders should appear first in the result', () => __awaiter(void 0, void 0, void 0, function* () {
                const args = { query: '1', extraFolders: [ALL_FOLDER, GENERAL_FOLDER] };
                const searchHits = [{ id: 1, title: 'Folder 1' }];
                getTestContext(searchHits);
                const result = yield getFoldersAsOptions(args);
                expect(result).toEqual([{ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' }]);
            }));
        });
    });
});
describe('getFolderAsOption', () => {
    describe('when called with undefined', () => {
        it('then it should return undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFolderByIdSpy } = getTestContext();
            const result = yield getFolderAsOption(undefined);
            expect(result).toBeUndefined();
            expect(getFolderByIdSpy).not.toHaveBeenCalled();
        }));
    });
    describe('when called with a folder id that does not exist', () => {
        silenceConsoleOutput();
        it('then it should return undefined', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFolderByIdSpy } = getTestContext();
            getFolderByIdSpy.mockRejectedValue('Not found');
            const result = yield getFolderAsOption(-1);
            expect(result).toBeUndefined();
            expect(getFolderByIdSpy).toHaveBeenCalled();
        }));
    });
    describe('when called with a folder id that exist', () => {
        it('then it should return a SelectableValue of FolderInfo', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFolderByIdSpy } = getTestContext();
            const result = yield getFolderAsOption(1);
            expect(result).toEqual({ value: { id: 1, title: 'Folder 1' }, label: 'Folder 1' });
            expect(getFolderByIdSpy).toHaveBeenCalled();
        }));
    });
});
//# sourceMappingURL=api.test.js.map