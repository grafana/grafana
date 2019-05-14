import * as tslib_1 from "tslib";
import React from 'react';
import { FolderSettingsPage } from './FolderSettingsPage';
import { shallow } from 'enzyme';
var setup = function (propOverrides) {
    var props = {
        navModel: {},
        folderUid: '1234',
        folder: {
            id: 0,
            uid: '1234',
            title: 'loading',
            canSave: true,
            url: 'url',
            hasChanged: false,
            version: 1,
            permissions: [],
        },
        getFolderByUid: jest.fn(),
        setFolderTitle: jest.fn(),
        saveFolder: jest.fn(),
        deleteFolder: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(FolderSettingsPage, tslib_1.__assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should enable save button', function () {
        var wrapper = setup({
            folder: {
                id: 1,
                uid: '1234',
                title: 'loading',
                canSave: true,
                hasChanged: true,
                version: 1,
            },
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=FolderSettingsPage.test.js.map