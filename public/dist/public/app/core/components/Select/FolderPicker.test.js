import { __awaiter, __generator } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { FolderPicker, getInitialValues } from './FolderPicker';
import * as api from 'app/features/manage-dashboards/state/actions';
describe('FolderPicker', function () {
    it('should render', function () {
        jest
            .spyOn(api, 'searchFolders')
            .mockResolvedValue([
            { title: 'Dash 1', id: 1 },
            { title: 'Dash 2', id: 2 },
        ]);
        var wrapper = shallow(React.createElement(FolderPicker, { onChange: jest.fn() }));
        expect(wrapper).toMatchSnapshot();
    });
});
describe('getInitialValues', function () {
    describe('when called with folderId and title', function () {
        it('then it should return folderId and title', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolder, folder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolder = jest.fn().mockResolvedValue({});
                        return [4 /*yield*/, getInitialValues({ folderId: 0, folderName: 'Some title', getFolder: getFolder })];
                    case 1:
                        folder = _a.sent();
                        expect(folder).toEqual({ label: 'Some title', value: 0 });
                        expect(getFolder).not.toHaveBeenCalled();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called with just a folderId', function () {
        it('then it should call api to retrieve title', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolder, folder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolder = jest.fn().mockResolvedValue({ id: 0, title: 'Title from api' });
                        return [4 /*yield*/, getInitialValues({ folderId: 0, getFolder: getFolder })];
                    case 1:
                        folder = _a.sent();
                        expect(folder).toEqual({ label: 'Title from api', value: 0 });
                        expect(getFolder).toHaveBeenCalledTimes(1);
                        expect(getFolder).toHaveBeenCalledWith(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when called without folderId', function () {
        it('then it should throw an error', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getFolder;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        getFolder = jest.fn().mockResolvedValue({});
                        return [4 /*yield*/, expect(getInitialValues({ getFolder: getFolder })).rejects.toThrow()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=FolderPicker.test.js.map