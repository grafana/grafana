import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { UsersListPage } from './UsersListPage';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setUsersSearchPage, setUsersSearchQuery } from './state/reducers';
jest.mock('../../core/app_events', function () { return ({
    emit: jest.fn(),
}); });
var setup = function (propOverrides) {
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Users',
            },
        },
        users: [],
        invitees: [],
        searchQuery: '',
        searchPage: 1,
        externalUserMngInfo: '',
        loadInvitees: jest.fn(),
        loadUsers: jest.fn(),
        updateUser: jest.fn(),
        removeUser: jest.fn(),
        setUsersSearchQuery: mockToolkitActionCreator(setUsersSearchQuery),
        setUsersSearchPage: mockToolkitActionCreator(setUsersSearchPage),
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(UsersListPage, __assign({}, props)));
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
    it('should render List page', function () {
        var wrapper = setup({
            hasFetched: true,
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=UsersListPage.test.js.map