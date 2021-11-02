import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamPermissionLevel } from '../../types';
import { getMockTeamMember } from './__mocks__/teamMocks';
import { TeamMemberRow } from './TeamMemberRow';
var setup = function (propOverrides) {
    var props = {
        member: getMockTeamMember(),
        syncEnabled: false,
        editorsCanAdmin: false,
        signedInUserIsTeamAdmin: false,
        updateTeamMember: jest.fn(),
        removeTeamMember: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamMemberRow, __assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render team members when sync enabled', function () {
        var member = getMockTeamMember();
        member.labels = ['LDAP'];
        var wrapper = setup({ member: member, syncEnabled: true }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    describe('when feature toggle editorsCanAdmin is turned on', function () {
        it('should render permissions select if user is team admin', function () {
            var wrapper = setup({ editorsCanAdmin: true, signedInUserIsTeamAdmin: true }).wrapper;
            expect(wrapper).toMatchSnapshot();
        });
        it('should render span and disable buttons if user is team member', function () {
            var wrapper = setup({ editorsCanAdmin: true, signedInUserIsTeamAdmin: false }).wrapper;
            expect(wrapper).toMatchSnapshot();
        });
    });
    describe('when feature toggle editorsCanAdmin is turned off', function () {
        it('should not render permissions', function () {
            var wrapper = setup({ editorsCanAdmin: false, signedInUserIsTeamAdmin: true }).wrapper;
            expect(wrapper).toMatchSnapshot();
        });
    });
});
describe('Functions', function () {
    describe('on remove member', function () {
        var member = getMockTeamMember();
        var instance = setup({ member: member }).instance;
        instance.onRemoveMember(member);
        expect(instance.props.removeTeamMember).toHaveBeenCalledWith(1);
    });
    describe('on update permision for user in team', function () {
        var member = {
            userId: 3,
            teamId: 2,
            avatarUrl: '',
            email: 'user@user.org',
            login: 'member',
            name: 'member',
            labels: [],
            permission: TeamPermissionLevel.Member,
        };
        var instance = setup({ member: member }).instance;
        var permission = TeamPermissionLevel.Admin;
        var item = { value: permission };
        var expectedTeamMemeber = __assign(__assign({}, member), { permission: permission });
        instance.onPermissionChange(item, member);
        expect(instance.props.updateTeamMember).toHaveBeenCalledWith(expectedTeamMemeber);
    });
});
//# sourceMappingURL=TeamMemberRow.test.js.map