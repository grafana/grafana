import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { UsersListPage } from './UsersListPage';
import { getMockUser } from './__mocks__/userMocks';
import appEvents from '../../core/app_events';
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
        externalUserMngInfo: '',
        loadInvitees: jest.fn(),
        loadUsers: jest.fn(),
        updateUser: jest.fn(),
        removeUser: jest.fn(),
        setUsersSearchQuery: jest.fn(),
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(UsersListPage, tslib_1.__assign({}, props)));
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
describe('Functions', function () {
    it('should emit show remove user modal', function () {
        var instance = setup().instance;
        var mockUser = getMockUser();
        instance.onRemoveUser(mockUser);
        expect(appEvents.emit).toHaveBeenCalled();
    });
});
//# sourceMappingURL=UsersListPage.test.js.map