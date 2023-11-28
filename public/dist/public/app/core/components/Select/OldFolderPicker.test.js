import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import selectEvent from 'react-select-event';
import { selectors } from '@grafana/e2e-selectors';
import { contextSrv } from 'app/core/core';
import * as api from 'app/features/manage-dashboards/state/actions';
import { OldFolderPicker, getInitialValues } from './OldFolderPicker';
describe('OldFolderPicker', () => {
    it('should render', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
        ]);
        render(React.createElement(OldFolderPicker, { onChange: jest.fn() }));
        expect(yield screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
    }));
    it('Should apply filter to the folders search results', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
            { title: 'Dash 3', uid: '7MeksYbmk' },
        ]);
        render(React.createElement(OldFolderPicker, { onChange: jest.fn(), filter: (hits) => hits.filter((h) => h.uid !== 'wfTJJL5Wz') }));
        const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
        selectEvent.openMenu(pickerContainer);
        const pickerOptions = yield screen.findAllByLabelText('Select option');
        expect(pickerOptions).toHaveLength(2);
        expect(pickerOptions[0]).toHaveTextContent('Dash 1');
        expect(pickerOptions[1]).toHaveTextContent('Dash 3');
    }));
    it('should allow creating a new option', () => __awaiter(void 0, void 0, void 0, function* () {
        const newFolder = { title: 'New Folder', uid: '7MeksYbmk' };
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
        ]);
        const onChangeFn = jest.fn();
        const create = jest.spyOn(api, 'createFolder').mockResolvedValue(newFolder);
        render(React.createElement(OldFolderPicker, { onChange: onChangeFn, enableCreateNew: true, allowEmpty: true }));
        expect(yield screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
        yield userEvent.type(screen.getByLabelText('Select a folder'), newFolder.title);
        const enter = yield screen.findByText('Hit enter to add');
        yield userEvent.click(enter);
        yield waitFor(() => {
            expect(create).toHaveBeenCalledWith({ title: newFolder.title });
        });
        expect(onChangeFn).toHaveBeenCalledWith({ title: newFolder.title, uid: newFolder.uid });
        yield waitFor(() => {
            expect(screen.getByText(newFolder.title)).toBeInTheDocument();
        });
    }));
    it('should show the General folder by default for editors', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
        ]);
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        const onChangeFn = jest.fn();
        render(React.createElement(OldFolderPicker, { onChange: onChangeFn }));
        expect(yield screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
        const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
        selectEvent.openMenu(pickerContainer);
        const pickerOptions = yield screen.findAllByLabelText('Select option');
        expect(pickerOptions[0]).toHaveTextContent('General');
    }));
    it('should not show the General folder by default if showRoot is false', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
        ]);
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
        const onChangeFn = jest.fn();
        render(React.createElement(OldFolderPicker, { onChange: onChangeFn, showRoot: false }));
        expect(yield screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
        const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
        selectEvent.openMenu(pickerContainer);
        const pickerOptions = yield screen.findAllByLabelText('Select option');
        expect(pickerOptions[0]).not.toHaveTextContent('General');
    }));
    it('should not show the General folder by default for not editors', () => __awaiter(void 0, void 0, void 0, function* () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', uid: 'xMsQdBfWz' },
            { title: 'Dash 2', uid: 'wfTJJL5Wz' },
        ]);
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        const onChangeFn = jest.fn();
        render(React.createElement(OldFolderPicker, { onChange: onChangeFn }));
        expect(yield screen.findByTestId(selectors.components.FolderPicker.containerV2)).toBeInTheDocument();
        const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
        selectEvent.openMenu(pickerContainer);
        const pickerOptions = yield screen.findAllByLabelText('Select option');
        expect(pickerOptions[0]).not.toHaveTextContent('General');
    }));
    it('should return the correct search results when typing in the select', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(api, 'searchFolders').mockImplementation((query) => {
            return Promise.resolve([
                { title: 'Dash Test', uid: 'xMsQdBfWz' },
                { title: 'Dash Two', uid: 'wfTJJL5Wz' },
            ].filter((dash) => dash.title.indexOf(query) > -1));
        });
        jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);
        const onChangeFn = jest.fn();
        render(React.createElement(OldFolderPicker, { onChange: onChangeFn }));
        const pickerContainer = screen.getByLabelText(selectors.components.FolderPicker.input);
        yield userEvent.type(pickerContainer, 'Test');
        expect(yield screen.findByText('Dash Test')).toBeInTheDocument();
        expect(screen.queryByText('Dash Two')).not.toBeInTheDocument();
    }));
});
describe('getInitialValues', () => {
    describe('when called with folderUid and title', () => {
        it('then it should return folderUid and title', () => __awaiter(void 0, void 0, void 0, function* () {
            const getFolder = jest.fn().mockResolvedValue({});
            const folder = yield getInitialValues({ folderUid: '', folderName: 'Some title', getFolder });
            expect(folder).toEqual({ label: 'Some title', value: '' });
            expect(getFolder).not.toHaveBeenCalled();
        }));
    });
    describe('when called with just a folderUid', () => {
        it('then it should call api to retrieve title', () => __awaiter(void 0, void 0, void 0, function* () {
            const getFolder = jest.fn().mockResolvedValue({ uid: '', title: 'Title from api' });
            const folder = yield getInitialValues({ folderUid: '', getFolder });
            expect(folder).toEqual({ label: 'Title from api', value: '' });
            expect(getFolder).toHaveBeenCalledTimes(1);
            expect(getFolder).toHaveBeenCalledWith('');
        }));
    });
    describe('when called without folderUid', () => {
        it('then it should throw an error', () => __awaiter(void 0, void 0, void 0, function* () {
            const getFolder = jest.fn().mockResolvedValue({});
            yield expect(getInitialValues({ getFolder })).rejects.toThrow();
        }));
    });
});
//# sourceMappingURL=OldFolderPicker.test.js.map