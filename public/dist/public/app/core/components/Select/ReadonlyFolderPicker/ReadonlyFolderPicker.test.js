import { __awaiter } from "tslib";
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { byTestId } from 'testing-library-selector';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { PermissionLevelString } from '../../../../types';
import { ALL_FOLDER, GENERAL_FOLDER, ReadonlyFolderPicker } from './ReadonlyFolderPicker';
import * as api from './api';
const FOLDERS = [
    { value: GENERAL_FOLDER, label: GENERAL_FOLDER.title },
    { value: { id: 1, title: 'Test' }, label: 'Test' },
];
function getTestContext(propOverrides = {}, folders = [], folder = undefined) {
    return __awaiter(this, void 0, void 0, function* () {
        jest.clearAllMocks();
        const selectors = {
            container: byTestId(e2eSelectors.components.ReadonlyFolderPicker.container),
        };
        const getFoldersAsOptionsSpy = jest.spyOn(api, 'getFoldersAsOptions').mockResolvedValue(folders);
        const getFolderAsOptionSpy = jest.spyOn(api, 'getFolderAsOption').mockResolvedValue(folder);
        const props = {
            onChange: jest.fn(),
        };
        Object.assign(props, propOverrides);
        render(React.createElement(ReadonlyFolderPicker, Object.assign({}, props)));
        yield waitFor(() => expect(screen.queryByText(/Loading/)).not.toBeInTheDocument());
        return { getFoldersAsOptionsSpy, getFolderAsOptionSpy, selectors };
    });
}
describe('ReadonlyFolderPicker', () => {
    describe('when there are no folders', () => {
        it('then the no folder should be selected and Choose should appear', () => __awaiter(void 0, void 0, void 0, function* () {
            const { selectors } = yield getTestContext();
            expect(within(selectors.container.get()).getByText('Choose')).toBeInTheDocument();
        }));
    });
    describe('when permissionLevel is set', () => {
        it('then permissionLevel is passed correctly to getFoldersAsOptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFoldersAsOptionsSpy } = yield getTestContext({ permissionLevel: PermissionLevelString.Edit });
            expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                query: '',
                permissionLevel: 'Edit',
                extraFolders: [],
            });
        }));
    });
    describe('when extraFolders is set', () => {
        it('then extraFolders is passed correctly to getFoldersAsOptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFoldersAsOptionsSpy } = yield getTestContext({ extraFolders: [ALL_FOLDER] });
            expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                query: '',
                permissionLevel: 'View',
                extraFolders: [{ id: undefined, title: 'All' }],
            });
        }));
    });
    describe('when entering a query in the input', () => {
        it('then query is passed correctly to getFoldersAsOptions', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getFoldersAsOptionsSpy, selectors } = yield getTestContext();
            expect(within(selectors.container.get()).getByRole('combobox')).toBeInTheDocument();
            getFoldersAsOptionsSpy.mockClear();
            yield userEvent.type(within(selectors.container.get()).getByRole('combobox'), 'A');
            yield waitFor(() => expect(getFoldersAsOptionsSpy).toHaveBeenCalledTimes(1));
            expect(getFoldersAsOptionsSpy).toHaveBeenCalledWith({
                query: 'A',
                permissionLevel: 'View',
                extraFolders: [],
            });
        }));
    });
    describe('when there are folders', () => {
        it('then the first folder in all folders should be selected', () => __awaiter(void 0, void 0, void 0, function* () {
            const { selectors } = yield getTestContext({}, FOLDERS);
            expect(yield within(selectors.container.get()).findByText('General')).toBeInTheDocument();
        }));
        describe('and initialFolderId is passed in props and it matches an existing folder', () => {
            it('then the folder with an id equal to initialFolderId should be selected', () => __awaiter(void 0, void 0, void 0, function* () {
                const { selectors } = yield getTestContext({ initialFolderId: 1 }, FOLDERS);
                expect(yield within(selectors.container.get()).findByText('Test')).toBeInTheDocument();
            }));
        });
        describe('and initialFolderId is passed in props and it does not match an existing folder from search api', () => {
            it('then getFolderAsOption should be called and correct folder should be selected', () => __awaiter(void 0, void 0, void 0, function* () {
                const folderById = {
                    value: { id: 50000, title: 'Outside api search' },
                    label: 'Outside api search',
                };
                const { selectors, getFolderAsOptionSpy } = yield getTestContext({ initialFolderId: 50000 }, FOLDERS, folderById);
                expect(yield within(selectors.container.get()).findByText('Outside api search')).toBeInTheDocument();
                expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
                expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
            }));
        });
        describe('and initialFolderId is passed in props and folder does not exist', () => {
            it('then getFolderAsOption should be called and the first folder should be selected instead', () => __awaiter(void 0, void 0, void 0, function* () {
                const { selectors, getFolderAsOptionSpy } = yield getTestContext({ initialFolderId: 50000 }, FOLDERS, undefined);
                expect(yield within(selectors.container.get()).findByText('General')).toBeInTheDocument();
                expect(getFolderAsOptionSpy).toHaveBeenCalledTimes(1);
                expect(getFolderAsOptionSpy).toHaveBeenCalledWith(50000);
            }));
        });
    });
});
//# sourceMappingURL=ReadonlyFolderPicker.test.js.map