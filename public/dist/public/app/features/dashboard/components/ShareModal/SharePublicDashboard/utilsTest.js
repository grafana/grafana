import { __awaiter } from "tslib";
import { fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import { rest } from 'msw';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '../../../../../store/configureStore';
import { DashboardInitPhase } from '../../../../../types';
import { PanelModel } from '../../../state';
import { createDashboardModelFixture } from '../../../state/__fixtures__/dashboardFixtures';
import { ShareModal } from '../ShareModal';
import { PublicDashboardShareType } from './SharePublicDashboardUtils';
export const mockDashboard = createDashboardModelFixture({
    uid: 'mockDashboardUid',
    timezone: 'utc',
});
export const mockPanel = new PanelModel({
    id: 'mockPanelId',
});
export const pubdashResponse = {
    isEnabled: true,
    annotationsEnabled: true,
    timeSelectionEnabled: true,
    uid: 'a-uid',
    dashboardUid: '',
    accessToken: 'an-access-token',
    share: PublicDashboardShareType.PUBLIC,
};
export const getExistentPublicDashboardResponse = (publicDashboard) => rest.get('/api/dashboards/uid/:dashboardUid/public-dashboards', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(Object.assign(Object.assign(Object.assign({}, pubdashResponse), publicDashboard), { dashboardUid: req.params.dashboardUid })));
});
export const renderSharePublicDashboard = (props, isEnabled = true) => __awaiter(void 0, void 0, void 0, function* () {
    const store = configureStore({
        dashboard: {
            getModel: () => (props === null || props === void 0 ? void 0 : props.dashboard) || mockDashboard,
            permissions: [],
            initError: null,
            initPhase: DashboardInitPhase.Completed,
        },
    });
    const newProps = Object.assign({
        panel: mockPanel,
        dashboard: mockDashboard,
        onDismiss: () => { },
    }, props);
    const renderResult = render(React.createElement(Provider, { store: store },
        React.createElement(ShareModal, Object.assign({}, newProps))));
    yield waitFor(() => screen.getByText('Link'));
    if (isEnabled) {
        fireEvent.click(screen.getByText('Public dashboard'));
        yield waitForElementToBeRemoved(screen.getByText('Loading configuration'));
    }
    return renderResult;
});
//# sourceMappingURL=utilsTest.js.map