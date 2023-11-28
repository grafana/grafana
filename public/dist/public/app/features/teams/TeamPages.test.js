import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { createTheme } from '@grafana/data';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { TeamPages } from './TeamPages';
import { getMockTeam } from './__mocks__/teamMocks';
jest.mock('app/core/components/Select/UserPicker', () => {
    return { UserPicker: () => null };
});
jest.mock('app/core/services/context_srv', () => ({
    contextSrv: {
        accessControlEnabled: () => true,
        hasPermissionInMetadata: () => true,
        user: {},
    },
}));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        get: jest.fn().mockResolvedValue([{ userId: 1, login: 'Test' }]),
    }), config: {
        licenseInfo: {
            enabledFeatures: { teamsync: true },
            stateInfo: '',
            licenseUrl: '',
        },
        featureToggles: { accesscontrol: true },
        bootData: { navTree: [], user: {} },
        buildInfo: {
            edition: 'Open Source',
            version: '7.5.0',
            commit: 'abc123',
            env: 'production',
            latestVersion: '',
            hasUpdate: false,
            hideVersion: false,
        },
        appSubUrl: '',
    }, featureEnabled: () => true })));
// Mock connected child components instead of rendering them
jest.mock('./TeamSettings', () => {
    //eslint-disable-next-line
    return () => React.createElement("div", null, "Team settings");
});
jest.mock('./TeamGroupSync', () => {
    //eslint-disable-next-line
    return () => React.createElement("div", null, "Team group sync");
});
const setup = (propOverrides) => {
    const props = Object.assign(Object.assign({}, getRouteComponentProps({
        match: {
            params: {
                id: '1',
                page: null,
            },
        },
    })), { pageNav: { text: 'Cool team ' }, teamId: 1, loadTeam: jest.fn(), pageName: 'members', team: {}, theme: createTheme() });
    Object.assign(props, propOverrides);
    render(React.createElement(TestProvider, null,
        React.createElement(TeamPages, Object.assign({}, props))));
};
describe('TeamPages', () => {
    it('should render settings and preferences page', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            team: getMockTeam(),
            pageName: 'settings',
            preferences: {
                homeDashboardUID: 'home-dashboard',
                theme: 'Default',
                timezone: 'Default',
            },
        });
        expect(yield screen.findByText('Team settings')).toBeInTheDocument();
    }));
    it('should render group sync page', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({
            team: getMockTeam(),
            pageName: 'groupsync',
        });
        expect(yield screen.findByText('Team group sync')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=TeamPages.test.js.map