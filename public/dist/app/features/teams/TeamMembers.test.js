import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamMembers } from './TeamMembers';
import { getMockTeamMember, getMockTeamMembers } from './__mocks__/teamMocks';
var setup = function (propOverrides) {
    var props = {
        members: [],
        searchMemberQuery: '',
        setSearchMemberQuery: jest.fn(),
        loadTeamMembers: jest.fn(),
        addTeamMember: jest.fn(),
        removeTeamMember: jest.fn(),
        syncEnabled: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamMembers, tslib_1.__assign({}, props)));
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
    it('should render team members', function () {
        var wrapper = setup({
            members: getMockTeamMembers(5),
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render team members when sync enabled', function () {
        var wrapper = setup({
            members: getMockTeamMembers(5),
            syncEnabled: true,
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Functions', function () {
    describe('on search member query change', function () {
        it('it should call setSearchMemberQuery', function () {
            var instance = setup().instance;
            instance.onSearchQueryChange('member');
            expect(instance.props.setSearchMemberQuery).toHaveBeenCalledWith('member');
        });
    });
    describe('on remove member', function () {
        var instance = setup().instance;
        var mockTeamMember = getMockTeamMember();
        instance.onRemoveMember(mockTeamMember);
        expect(instance.props.removeTeamMember).toHaveBeenCalledWith(1);
    });
    describe('on add user to team', function () {
        var _a = setup(), wrapper = _a.wrapper, instance = _a.instance;
        var state = wrapper.state();
        state.newTeamMember = {
            id: 1,
            label: '',
            avatarUrl: '',
            login: '',
        };
        instance.onAddUserToTeam();
        expect(instance.props.addTeamMember).toHaveBeenCalledWith(1);
    });
});
//# sourceMappingURL=TeamMembers.test.js.map