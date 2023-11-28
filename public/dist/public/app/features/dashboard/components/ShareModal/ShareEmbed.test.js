import { render, screen } from '@testing-library/react';
import React from 'react';
import { setEchoSrv } from '@grafana/runtime/src';
import config from 'app/core/config';
import { Echo } from '../../../../core/services/echo/Echo';
import { PanelModel } from '../../state';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import { ShareEmbed } from './ShareEmbed';
jest.mock('app/features/dashboard/services/TimeSrv', () => ({
    getTimeSrv: () => ({
        timeRange: () => {
            return { from: new Date(1000), to: new Date(2000) };
        },
    }),
}));
jest.mock('app/core/services/context_srv', () => ({
    contextSrv: {
        sidemenu: true,
        user: {},
        isSignedIn: false,
        isGrafanaAdmin: false,
        isEditor: false,
        hasEditPermissionFolders: false,
    },
}));
function mockLocationHref(href) {
    const location = window.location;
    let search = '';
    const searchPos = href.indexOf('?');
    if (searchPos >= 0) {
        search = href.substring(searchPos);
    }
    // @ts-ignore
    delete window.location;
    window.location = Object.assign(Object.assign({}, location), { href, origin: new URL(href).origin, search });
}
describe('ShareEmbed', () => {
    let originalBootData;
    beforeAll(() => {
        setEchoSrv(new Echo());
        originalBootData = config.bootData;
        config.appUrl = 'http://dashboards.grafana.com/';
        config.bootData = {
            user: {
                orgId: 1,
            },
        };
    });
    afterAll(() => {
        config.bootData = originalBootData;
    });
    it('generates the correct embed url for a dashboard', () => {
        const mockDashboard = createDashboardModelFixture({
            uid: 'mockDashboardUid',
        });
        const mockPanel = new PanelModel({
            id: 'mockPanelId',
        });
        mockLocationHref(`http://dashboards.grafana.com/d/${mockDashboard.uid}?orgId=1`);
        render(React.createElement(ShareEmbed, { dashboard: mockDashboard, panel: mockPanel }));
        const embedUrl = screen.getByTestId('share-embed-html');
        expect(embedUrl).toBeInTheDocument();
        expect(embedUrl).toHaveTextContent(`http://dashboards.grafana.com/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`);
    });
    it('generates the correct embed url for a dashboard set to the homepage in the grafana config', () => {
        mockLocationHref('http://dashboards.grafana.com/?orgId=1');
        const mockDashboard = createDashboardModelFixture({
            uid: 'mockDashboardUid',
        });
        const mockPanel = new PanelModel({
            id: 'mockPanelId',
        });
        render(React.createElement(ShareEmbed, { dashboard: mockDashboard, panel: mockPanel }));
        const embedUrl = screen.getByTestId('share-embed-html');
        expect(embedUrl).toBeInTheDocument();
        expect(embedUrl).toHaveTextContent(`http://dashboards.grafana.com/d-solo/${mockDashboard.uid}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`);
    });
    it('generates the correct embed url for a snapshot', () => {
        const mockSlug = 'mockSlug';
        mockLocationHref(`http://dashboards.grafana.com/dashboard/snapshot/${mockSlug}?orgId=1`);
        const mockDashboard = createDashboardModelFixture({
            uid: 'mockDashboardUid',
        });
        const mockPanel = new PanelModel({
            id: 'mockPanelId',
        });
        render(React.createElement(ShareEmbed, { dashboard: mockDashboard, panel: mockPanel }));
        const embedUrl = screen.getByTestId('share-embed-html');
        expect(embedUrl).toBeInTheDocument();
        expect(embedUrl).toHaveTextContent(`http://dashboards.grafana.com/dashboard-solo/snapshot/${mockSlug}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`);
    });
    it('generates the correct embed url for a scripted dashboard', () => {
        const mockSlug = 'scripted.js';
        mockLocationHref(`http://dashboards.grafana.com/dashboard/script/${mockSlug}?orgId=1`);
        const mockDashboard = createDashboardModelFixture({
            uid: 'mockDashboardUid',
        });
        const mockPanel = new PanelModel({
            id: 'mockPanelId',
        });
        render(React.createElement(ShareEmbed, { dashboard: mockDashboard, panel: mockPanel }));
        const embedUrl = screen.getByTestId('share-embed-html');
        expect(embedUrl).toBeInTheDocument();
        expect(embedUrl).toHaveTextContent(`http://dashboards.grafana.com/dashboard-solo/script/${mockSlug}?orgId=1&from=1000&to=2000&panelId=${mockPanel.id}`);
    });
});
//# sourceMappingURL=ShareEmbed.test.js.map