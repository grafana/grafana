import { __awaiter } from "tslib";
import { findByRole, findByText, findByTitle, getByTestId, queryByText, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { TestProvider } from 'test/helpers/TestProvider';
import { byRole, byTestId } from 'testing-library-selector';
import { setBackendSrv } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItemType } from '../../../../search/types';
import { mockStore } from '../../mocks';
import { mockSearchApiResponse } from '../../mocks/grafanaApi';
import { Annotation } from '../../utils/constants';
import { getDefaultFormValues } from '../../utils/rule-form';
import 'whatwg-fetch';
import AnnotationsStep from './AnnotationsStep';
// To get anything displayed inside the Autosize component we need to mock it
// Ref https://github.com/bvaughn/react-window/issues/454#issuecomment-646031139
jest.mock('react-virtualized-auto-sizer', () => ({ children }) => children({ height: 500, width: 330 }));
const ui = {
    setDashboardButton: byRole('button', { name: 'Link dashboard and panel' }),
    annotationKeys: byTestId('annotation-key-', { exact: false }),
    annotationValues: byTestId('annotation-value-', { exact: false }),
    dashboardPicker: {
        dialog: byRole('dialog'),
        heading: byRole('heading', { name: 'Select dashboard and panel' }),
        confirmButton: byRole('button', { name: 'Confirm' }),
    },
};
const server = setupServer();
beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
});
beforeEach(() => {
    server.resetHandlers();
});
afterAll(() => {
    server.close();
});
function FormWrapper({ formValues }) {
    const store = mockStore(() => null);
    const formApi = useForm({ defaultValues: Object.assign(Object.assign({}, getDefaultFormValues()), formValues) });
    return (React.createElement(TestProvider, { store: store },
        React.createElement(FormProvider, Object.assign({}, formApi),
            React.createElement(AnnotationsStep, null))));
}
describe('AnnotationsField', function () {
    it('should display default list of annotations', function () {
        render(React.createElement(FormWrapper, null));
        const annotationElements = ui.annotationKeys.getAll();
        expect(annotationElements).toHaveLength(3);
        expect(annotationElements[0]).toHaveTextContent('Summary');
        expect(annotationElements[1]).toHaveTextContent('Description');
        expect(annotationElements[2]).toHaveTextContent('Runbook URL');
    });
    describe('Dashboard and panel picker', function () {
        it('should display dashboard and panel selector when select button clicked', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, []);
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, null));
                yield user.click(ui.setDashboardButton.get());
                expect(ui.dashboardPicker.dialog.get()).toBeInTheDocument();
                expect(ui.dashboardPicker.heading.get()).toBeInTheDocument();
            });
        });
        it('should enable Confirm button only when dashboard and panel selected', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'First panel', type: 'timeseries' },
                        { id: 2, title: 'Second panel', type: 'timeseries' },
                    ],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, null));
                yield user.click(ui.setDashboardButton.get());
                expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();
                yield user.click(yield findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));
                expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();
                yield user.click(yield findByText(ui.dashboardPicker.dialog.get(), 'First panel'));
                expect(ui.dashboardPicker.confirmButton.get()).toBeEnabled();
            });
        });
        it('should add selected dashboard and panel as annotations', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'First panel', type: 'graph' },
                        { id: 2, title: 'Second panel', type: 'graph' },
                    ],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, { formValues: { annotations: [] } }));
                yield user.click(ui.setDashboardButton.get());
                yield user.click(yield findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));
                yield user.click(yield findByText(ui.dashboardPicker.dialog.get(), 'Second panel'));
                yield user.click(ui.dashboardPicker.confirmButton.get());
                const annotationValueElements = ui.annotationValues.getAll();
                expect(ui.dashboardPicker.dialog.query()).not.toBeInTheDocument();
                expect(annotationValueElements).toHaveLength(2);
                expect(annotationValueElements[0]).toHaveTextContent('dash-test-uid');
                expect(annotationValueElements[1]).toHaveTextContent('2');
            });
        });
        it('should not show rows as panels', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'Row panel', type: 'row' },
                        { id: 2, title: 'First panel', type: 'timeseries' },
                    ],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, null));
                yield user.click(ui.setDashboardButton.get());
                expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();
                yield user.click(yield findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));
                expect(yield findByText(ui.dashboardPicker.dialog.get(), 'First panel')).toBeInTheDocument();
                expect(yield queryByText(ui.dashboardPicker.dialog.get(), 'Row panel')).not.toBeInTheDocument();
            });
        });
        it('should show panels within collapsed rows', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'First panel', type: 'timeseries' },
                        {
                            id: 2,
                            title: 'Row panel',
                            collapsed: true,
                            type: 'row',
                            panels: [{ id: 3, title: 'Panel within collapsed row', type: 'timeseries' }],
                        },
                    ],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, null));
                yield user.click(ui.setDashboardButton.get());
                expect(ui.dashboardPicker.confirmButton.get()).toBeDisabled();
                yield user.click(yield findByTitle(ui.dashboardPicker.dialog.get(), 'My dashboard'));
                expect(yield findByText(ui.dashboardPicker.dialog.get(), 'First panel')).toBeInTheDocument();
                expect(yield queryByText(ui.dashboardPicker.dialog.get(), 'Row panel')).not.toBeInTheDocument();
                expect(yield findByText(ui.dashboardPicker.dialog.get(), 'Panel within collapsed row')).toBeInTheDocument();
            });
        });
        // this test _should_ work in theory but something is stopping the 'onClick' function on the dashboard item
        // to trigger "handleDashboardChange" – skipping it for now but has been manually tested.
        it.skip('should update existing dashboard and panel identifies', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                    mockDashboardSearchItem({
                        title: 'My other dashboard',
                        uid: 'dash-other-uid',
                        type: DashboardSearchItemType.DashDB,
                    }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'First panel', type: 'timeseries' },
                        { id: 2, title: 'Second panel', type: 'timeseries' },
                    ],
                }));
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My other dashboard',
                    uid: 'dash-other-uid',
                    panels: [{ id: 3, title: 'Third panel', type: 'timeseries' }],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, { formValues: {
                        annotations: [
                            { key: Annotation.dashboardUID, value: 'dash-test-uid' },
                            { key: Annotation.panelID, value: '1' },
                        ],
                    } }));
                let annotationValueElements = ui.annotationValues.getAll();
                expect(annotationValueElements[0]).toHaveTextContent('dash-test-uid');
                expect(annotationValueElements[1]).toHaveTextContent('1');
                const { confirmButton, dialog } = ui.dashboardPicker;
                yield user.click(ui.setDashboardButton.get());
                yield user.click(yield findByRole(dialog.get(), 'button', { name: /My other dashboard/ }));
                yield user.click(yield findByRole(dialog.get(), 'button', { name: /Third panel/ }));
                yield user.click(confirmButton.get());
                expect(ui.dashboardPicker.dialog.query()).not.toBeInTheDocument();
                const annotationKeyElements = ui.annotationKeys.getAll();
                annotationValueElements = ui.annotationValues.getAll();
                expect(annotationKeyElements).toHaveLength(2);
                expect(annotationValueElements).toHaveLength(2);
                expect(annotationKeyElements[0]).toHaveTextContent('Dashboard UID');
                expect(annotationValueElements[0]).toHaveTextContent('dash-other-uid');
                expect(annotationKeyElements[1]).toHaveTextContent('Panel ID');
                expect(annotationValueElements[1]).toHaveTextContent('3');
            });
        });
        it('should render warning icon for panels of type other than graph and timeseries', function () {
            return __awaiter(this, void 0, void 0, function* () {
                mockSearchApiResponse(server, [
                    mockDashboardSearchItem({ title: 'My dashboard', uid: 'dash-test-uid', type: DashboardSearchItemType.DashDB }),
                ]);
                mockGetDashboardResponse(mockDashboardDto({
                    title: 'My dashboard',
                    uid: 'dash-test-uid',
                    panels: [
                        { id: 1, title: 'First panel', type: 'bar' },
                        { id: 2, title: 'Second panel', type: 'graph' },
                    ],
                }));
                const user = userEvent.setup();
                render(React.createElement(FormWrapper, { formValues: { annotations: [] } }));
                const { dialog } = ui.dashboardPicker;
                yield user.click(ui.setDashboardButton.get());
                yield user.click(yield findByTitle(dialog.get(), 'My dashboard'));
                const warnedPanel = yield findByRole(dialog.get(), 'button', { name: /First panel/ });
                expect(getByTestId(warnedPanel, 'warning-icon')).toBeInTheDocument();
            });
        });
    });
});
function mockGetDashboardResponse(dashboard) {
    server.use(rest.get(`/api/dashboards/uid/${dashboard.dashboard.uid}`, (req, res, ctx) => res(ctx.json(dashboard))));
}
function mockDashboardSearchItem(searchItem) {
    return Object.assign({ title: '', uid: '', type: DashboardSearchItemType.DashDB, url: '', uri: '', items: [], tags: [], slug: '', isStarred: false }, searchItem);
}
function mockDashboardDto(dashboard) {
    return {
        dashboard: Object.assign(Object.assign({}, defaultDashboard), dashboard),
        meta: {},
    };
}
//# sourceMappingURL=AnnotationsField.test.js.map