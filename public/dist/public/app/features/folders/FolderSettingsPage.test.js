import { __assign } from "tslib";
import React from 'react';
import { FolderSettingsPage } from './FolderSettingsPage';
import { shallow } from 'enzyme';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setFolderTitle } from './state/reducers';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
var setup = function (propOverrides) {
    var props = __assign(__assign({}, getRouteComponentProps()), { navModel: {}, folderUid: '1234', folder: {
            id: 0,
            uid: '1234',
            title: 'loading',
            canSave: true,
            url: 'url',
            hasChanged: false,
            version: 1,
            permissions: [],
        }, getFolderByUid: jest.fn(), setFolderTitle: mockToolkitActionCreator(setFolderTitle), saveFolder: jest.fn(), deleteFolder: jest.fn() });
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(FolderSettingsPage, __assign({}, props)));
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