import { __assign } from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamPages } from './TeamPages';
import { OrgRole } from '../../types';
import { getMockTeam } from './__mocks__/teamMocks';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
jest.mock('app/core/config', function () { return (__assign(__assign({}, jest.requireActual('app/core/config')), { licenseInfo: {
        hasLicense: true,
    } })); });
var setup = function (propOverrides) {
    var props = __assign(__assign({}, getRouteComponentProps({
        match: {
            params: {
                id: '1',
                page: null,
            },
        },
    })), { navModel: {}, teamId: 1, loadTeam: jest.fn(), loadTeamMembers: jest.fn(), pageName: 'members', team: {}, members: [], editorsCanAdmin: false, signedInUser: {
            id: 1,
            isGrafanaAdmin: false,
            orgRole: OrgRole.Viewer,
        } });
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamPages, __assign({}, props)));
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
    describe('when feature toggle editorsCanAdmin is turned on', function () {
        it('should render settings page if user is team admin', function () {
            var wrapper = setup({
                team: getMockTeam(),
                pageName: 'settings',
                preferences: {
                    homeDashboardId: 1,
                    theme: 'Default',
                    timezone: 'Default',
                },
                editorsCanAdmin: true,
                signedInUser: {
                    id: 1,
                    isGrafanaAdmin: false,
                    orgRole: OrgRole.Admin,
                },
            }).wrapper;
            expect(wrapper).toMatchSnapshot();
        });
        it('should not render settings page if user is team member', function () {
            var wrapper = setup({
                team: getMockTeam(),
                pageName: 'settings',
                preferences: {
                    homeDashboardId: 1,
                    theme: 'Default',
                    timezone: 'Default',
                },
                editorsCanAdmin: true,
                signedInUser: {
                    id: 1,
                    isGrafanaAdmin: false,
                    orgRole: OrgRole.Viewer,
                },
            }).wrapper;
            expect(wrapper).toMatchSnapshot();
        });
    });
});
//# sourceMappingURL=TeamPages.test.js.map