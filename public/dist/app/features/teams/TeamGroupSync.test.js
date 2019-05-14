import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamGroupSync } from './TeamGroupSync';
import { getMockTeamGroups } from './__mocks__/teamMocks';
var setup = function (propOverrides) {
    var props = {
        groups: [],
        loadTeamGroups: jest.fn(),
        addTeamGroup: jest.fn(),
        removeTeamGroup: jest.fn(),
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamGroupSync, tslib_1.__assign({}, props)));
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
    it('should render groups table', function () {
        var wrapper = setup({
            groups: getMockTeamGroups(3),
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Functions', function () {
    it('should call add group', function () {
        var instance = setup().instance;
        instance.setState({ newGroupId: 'some/group' });
        var mockEvent = { preventDefault: jest.fn() };
        instance.onAddGroup(mockEvent);
        expect(instance.props.addTeamGroup).toHaveBeenCalledWith('some/group');
    });
    it('should call remove group', function () {
        var instance = setup().instance;
        var mockGroup = { teamId: 1, groupId: 'some/group' };
        instance.onRemoveGroup(mockGroup);
        expect(instance.props.removeTeamGroup).toHaveBeenCalledWith('some/group');
    });
});
//# sourceMappingURL=TeamGroupSync.test.js.map