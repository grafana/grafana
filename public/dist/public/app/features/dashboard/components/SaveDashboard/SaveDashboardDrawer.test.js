import { __awaiter } from "tslib";
import { render, waitFor, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';
import { createDashboardModelFixture } from '../../state/__fixtures__/dashboardFixtures';
import { SaveDashboardDrawer } from './SaveDashboardDrawer';
jest.mock('app/core/core', () => (Object.assign(Object.assign({}, jest.requireActual('app/core/core')), { contextSrv: {} })));
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => ({
        post: mockPost,
    }) })));
const store = configureStore();
const mockPost = jest.fn();
const buildMocks = () => ({
    dashboard: createDashboardModelFixture({
        uid: 'mockDashboardUid',
        version: 1,
    }),
    error: {
        status: 412,
        data: {
            status: 'plugin-dashboard',
        },
        config: {},
    },
    onDismiss: jest.fn(),
});
const CompWithProvider = (props) => (React.createElement(Provider, { store: store },
    React.createElement(SaveDashboardDrawer, Object.assign({}, props))));
const setup = (options) => waitFor(() => render(React.createElement(CompWithProvider, Object.assign({}, options))));
describe('SaveDashboardDrawer', () => {
    beforeEach(() => {
        mockPost.mockClear();
        jest.spyOn(console, 'error').mockImplementation();
    });
    it("renders a modal if there's an unhandled error", () => __awaiter(void 0, void 0, void 0, function* () {
        const { onDismiss, dashboard, error } = buildMocks();
        mockPost.mockRejectedValueOnce(error);
        yield setup({ dashboard, onDismiss });
        yield userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /save as/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /overwrite/i })).toBeInTheDocument();
    }));
    it('should render corresponding save modal once the error is handled', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onDismiss, dashboard, error } = buildMocks();
        mockPost.mockRejectedValueOnce(error);
        const { rerender } = yield setup({ dashboard, onDismiss });
        yield userEvent.click(screen.getByRole('button', { name: /save/i }));
        rerender(React.createElement(CompWithProvider, { dashboard: dashboard, onDismiss: onDismiss }));
        mockPost.mockClear();
        mockPost.mockRejectedValueOnce(Object.assign(Object.assign({}, error), { isHandled: true }));
        yield userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getByText(/save dashboard/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /save as/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /overwrite/i })).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=SaveDashboardDrawer.test.js.map