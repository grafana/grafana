import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { UsersActionBar } from './UsersActionBar';
var setup = function (propOverrides) {
    var props = {
        searchQuery: '',
        setUsersSearchQuery: jest.fn(),
        onShowInvites: jest.fn(),
        pendingInvitesCount: 0,
        canInvite: false,
        externalUserMngLinkUrl: '',
        externalUserMngLinkName: '',
        showInvites: false,
    };
    Object.assign(props, propOverrides);
    return shallow(React.createElement(UsersActionBar, tslib_1.__assign({}, props)));
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