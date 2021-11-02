import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamMembers } from './TeamMembers';
import { OrgRole } from '../../types';
import { getMockTeamMembers } from './__mocks__/teamMocks';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setSearchMemberQuery } from './state/reducers';
var signedInUserId = 1;
var setup = function (propOverrides) {
    var props = {
        members: [],
        searchMemberQuery: '',
        setSearchMemberQuery: mockToolkitActionCreator(setSearchMemberQuery),
        addTeamMember: jest.fn(),
        syncEnabled: false,
        editorsCanAdmin: false,
        signedInUser: {
            id: signedInUserId,
            isGrafanaAdmin: false,
            orgRole: OrgRole.Viewer,
        },
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamMembers, __assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup({}).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render team members', function () {
        var wrapper = setup({ members: getMockTeamMembers(5, 5) }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Functions', function () {
    describe('on search member query change', function () {
        it('it should call setSearchMemberQuery', function () {
            var instance = setup({}).instance;
            instance.onSearchQueryChange('member');
            expect(instance.props.setSearchMemberQuery).toHaveBeenCalledWith('member');
        });
    });
    describe('on add user to team', function () {
        var _a = setup({}), wrapper = _a.wrapper, instance = _a.instance;
        var state = wrapper.state();
        state.newTeamMember = {
            id: 1,
            label: '',
            avatarUrl: '',
            login: '',
            name: '',
            email: '',
        };
        instance.onAddUserToTeam();
        expect(instance.props.addTeamMember).toHaveBeenCalledWith(1);
    });
});
//# sourceMappingURL=TeamMembers.test.js.map