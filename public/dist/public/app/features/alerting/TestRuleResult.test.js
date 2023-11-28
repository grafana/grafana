import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PanelModel } from '../dashboard/state';
import { createDashboardModelFixture, createPanelSaveModel } from '../dashboard/state/__fixtures__/dashboardFixtures';
import { TestRuleResult } from './TestRuleResult';
const backendSrv = {
    post: jest.fn(),
};
jest.mock('@grafana/runtime', () => {
    const original = jest.requireActual('@grafana/runtime');
    return Object.assign(Object.assign({}, original), { getBackendSrv: () => backendSrv });
});
const props = {
    panel: new PanelModel({ id: 1 }),
    dashboard: createDashboardModelFixture({
        panels: [createPanelSaveModel({ id: 1 })],
    }),
};
describe('TestRuleResult', () => {
    it('should render without error', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(TestRuleResult, Object.assign({}, props)));
        yield screen.findByRole('button', { name: 'Copy to Clipboard' });
    }));
    it('should call testRule when mounting', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(backendSrv, 'post');
        render(React.createElement(TestRuleResult, Object.assign({}, props)));
        yield screen.findByRole('button', { name: 'Copy to Clipboard' });
        expect(backendSrv.post).toHaveBeenCalledWith('/api/alerts/test', expect.objectContaining({
            panelId: 1,
        }));
    }));
});
//# sourceMappingURL=TestRuleResult.test.js.map