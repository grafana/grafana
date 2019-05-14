import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamPages } from './TeamPages';
import { getMockTeam } from './__mocks__/teamMocks';
jest.mock('app/core/config', function () { return ({
    buildInfo: { isEnterprise: true },
}); });
var setup = function (propOverrides) {
    var props = {
        navModel: {},
        teamId: 1,
        loadTeam: jest.fn(),
        pageName: 'members',
        team: {},
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamPages, tslib_1.__assign({}, props)));
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
    it('should render member page if team not empty', function () {
        var wrapper = setup({
            team: getMockTeam(),
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render settings and preferences page', function () {
        var wrapper = setup({
            team: getMockTeam(),
            pageName: 'settings',
            preferences: {
                homeDashboardId: 1,
                theme: 'Default',
                timezone: 'Default',
            },
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render group sync page', function () {
        var wrapper = setup({
            team: getMockTeam(),
            pageName: 'groupsync',
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
//# sourceMappingURL=TeamPages.test.js.map