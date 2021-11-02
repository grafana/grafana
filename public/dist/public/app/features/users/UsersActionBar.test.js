import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { UsersActionBar } from './UsersActionBar';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setUsersSearchQuery } from './state/reducers';
jest.mock('app/core/core', function () { return ({
    contextSrv: {
        hasPermission: function () { return true; },
    },
}); });
var setup = function (propOverrides) {
    var props = {
        searchQuery: '',
        setUsersSearchQuery: mockToolkitActionCreator(setUsersSearchQuery),
        onShowInvites: jest.fn(),
        pendingInvitesCount: 0,
        canInvite: false,
        externalUserMngLinkUrl: '',
        externalUserMngLinkName: '',
        showInvites: false,
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(UsersActionBar, __assign({}, props)));
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup();
        expect(wrapper).toMatchSnapshot();
    });
    it('should render pending invites button', function () {
        var wrapper = setup({
            pendingInvitesCount: 5,
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should show invite button', function () {
        var wrapper = setup({
            canInvite: true,
        });
        expect(wrapper).toMatchSnapshot();
    });
    it('should show external user management button', function () {
        var wrapper = setup({
            externalUserMngLinkUrl: 'some/url',
        });
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=UsersActionBar.test.js.map