import { __awaiter } from "tslib";
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { defaultDashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { Echo } from 'app/core/services/echo/Echo';
import * as initDashboard from 'app/features/dashboard/state/initDashboard';
import { DashboardSearchItemType } from 'app/features/search/types';
import { configureStore } from 'app/store/configureStore';
import { createEmptyQueryResponse } from '../../state/utils';
import * as api from './addToDashboard';
import { AddToDashboard } from '.';
const setup = (children, queries = [{ refId: 'A' }]) => {
    const store = configureStore({
        explore: {
            panes: {
                left: {
                    queries,
                    queryResponse: createEmptyQueryResponse(),
                },
            },
        },
    });
    return render(React.createElement(Provider, { store: store }, children));
};
jest.mock('app/core/services/context_srv');
const mocks = {
    contextSrv: jest.mocked(contextSrv),
};
const openModal = (nameOverride) => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(screen.getByRole('button', { name: /add to dashboard/i }));
    expect(yield screen.findByRole('dialog', { name: nameOverride || 'Add panel to dashboard' })).toBeInTheDocument();
});
describe('AddToDashboardButton', () => {
    beforeAll(() => {
        setEchoSrv(new Echo());
    });
    it('Is disabled if explore pane has no queries', () => __awaiter(void 0, void 0, void 0, function* () {
        setup(React.createElement(AddToDashboard, { exploreId: 'left' }), []);
        const button = yield screen.findByRole('button', { name: /add to dashboard/i });
        expect(button).toBeDisabled();
        yield userEvent.click(button);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    }));
    describe('Success path', () => {
        const addToDashboardResponse = Promise.resolve();
        const waitForAddToDashboardResponse = () => __awaiter(void 0, void 0, void 0, function* () {
            return act(() => __awaiter(void 0, void 0, void 0, function* () {
                yield addToDashboardResponse;
            }));
        });
        beforeEach(() => {
            jest.spyOn(api, 'setDashboardInLocalStorage').mockReturnValue(addToDashboardResponse);
            mocks.contextSrv.hasPermission.mockImplementation(() => true);
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });
        it('Opens and closes the modal correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal();
            yield userEvent.click(screen.getByRole('button', { name: /cancel/i }));
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        }));
        describe('navigation', () => {
            it('Navigates to dashboard when clicking on "Open"', () => __awaiter(void 0, void 0, void 0, function* () {
                // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
                const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);
                const pushSpy = jest.spyOn(locationService, 'push');
                setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                yield openModal();
                yield userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));
                yield waitForAddToDashboardResponse();
                expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();
                expect(pushSpy).toHaveBeenCalled();
                expect(openSpy).not.toHaveBeenCalled();
            }));
            it('Navigates to dashboard in a new tab when clicking on "Open in a new tab"', () => __awaiter(void 0, void 0, void 0, function* () {
                // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
                const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);
                const pushSpy = jest.spyOn(locationService, 'push');
                setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                yield openModal();
                yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
                yield waitForAddToDashboardResponse();
                expect(openSpy).toHaveBeenCalledWith(expect.anything(), '_blank');
                expect(pushSpy).not.toHaveBeenCalled();
            }));
        });
        describe('Save to new dashboard', () => {
            describe('Navigate to correct dashboard when saving', () => {
                it('Opens the new dashboard in a new tab', () => __awaiter(void 0, void 0, void 0, function* () {
                    // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
                    const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);
                    setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                    yield openModal();
                    yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
                    yield waitForAddToDashboardResponse();
                    expect(openSpy).toHaveBeenCalledWith('dashboard/new', '_blank');
                }));
                it('Navigates to the new dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
                    const pushSpy = jest.spyOn(locationService, 'push');
                    setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                    yield openModal();
                    yield userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));
                    yield waitForAddToDashboardResponse();
                    expect(screen.queryByRole('dialog', { name: 'Add panel to dashboard' })).not.toBeInTheDocument();
                    expect(pushSpy).toHaveBeenCalledWith('dashboard/new');
                }));
            });
        });
        describe('Save to existing dashboard', () => {
            it('Renders the dashboard picker when switching to "Existing Dashboard"', () => __awaiter(void 0, void 0, void 0, function* () {
                setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                yield openModal();
                expect(screen.queryByRole('combobox', { name: /dashboard/ })).not.toBeInTheDocument();
                yield userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
                expect(screen.getByRole('combobox', { name: /dashboard/ })).toBeInTheDocument();
            }));
            it('Does not submit if no dashboard is selected', () => __awaiter(void 0, void 0, void 0, function* () {
                locationService.push = jest.fn();
                setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                yield openModal();
                yield userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
                yield userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));
                yield waitForAddToDashboardResponse();
                expect(locationService.push).not.toHaveBeenCalled();
            }));
            describe('Navigate to correct dashboard when saving', () => {
                it('Opens the selected dashboard in a new tab', () => __awaiter(void 0, void 0, void 0, function* () {
                    // @ts-expect-error global.open should return a Window, but is not implemented in js-dom.
                    const openSpy = jest.spyOn(global, 'open').mockReturnValue(true);
                    jest.spyOn(backendSrv, 'getDashboardByUid').mockResolvedValue({
                        dashboard: Object.assign(Object.assign({}, defaultDashboard), { templating: { list: [] }, title: 'Dashboard Title', uid: 'someUid' }),
                        meta: {},
                    });
                    jest.spyOn(backendSrv, 'search').mockResolvedValue([
                        {
                            uid: 'someUid',
                            isStarred: false,
                            title: 'Dashboard Title',
                            tags: [],
                            type: DashboardSearchItemType.DashDB,
                            uri: 'someUri',
                            url: 'someUrl',
                        },
                    ]);
                    setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                    yield openModal();
                    yield userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
                    yield userEvent.click(screen.getByRole('combobox', { name: /dashboard/i }));
                    yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                        yield screen.findByLabelText('Select option');
                    }));
                    yield userEvent.click(screen.getByLabelText('Select option'));
                    yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
                    yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                    }));
                    expect(openSpy).toBeCalledWith('d/someUid', '_blank');
                }));
                it('Navigates to the selected dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
                    const pushSpy = jest.spyOn(locationService, 'push');
                    jest.spyOn(backendSrv, 'getDashboardByUid').mockResolvedValue({
                        dashboard: Object.assign(Object.assign({}, defaultDashboard), { templating: { list: [] }, title: 'Dashboard Title', uid: 'someUid' }),
                        meta: {},
                    });
                    jest.spyOn(backendSrv, 'search').mockResolvedValue([
                        {
                            uid: 'someUid',
                            isStarred: false,
                            title: 'Dashboard Title',
                            tags: [],
                            type: DashboardSearchItemType.DashDB,
                            uri: 'someUri',
                            url: 'someUrl',
                        },
                    ]);
                    setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
                    yield openModal();
                    yield userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
                    yield userEvent.click(screen.getByRole('combobox', { name: /dashboard/i }));
                    yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                        yield screen.findByLabelText('Select option');
                    }));
                    yield userEvent.click(screen.getByLabelText('Select option'));
                    yield userEvent.click(screen.getByRole('button', { name: /open dashboard$/i }));
                    yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                    }));
                    expect(pushSpy).toBeCalledWith('d/someUid');
                }));
            });
        });
    });
    describe('Permissions', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });
        it('Should only show existing dashboard option with no access to create', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.contextSrv.hasPermission.mockImplementation((action) => {
                if (action === 'dashboards:create') {
                    return false;
                }
                else {
                    return true;
                }
            });
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal('Add panel to existing dashboard');
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        }));
        it('Should only show new dashboard option with no access to write', () => __awaiter(void 0, void 0, void 0, function* () {
            mocks.contextSrv.hasPermission.mockImplementation((action) => {
                if (action === 'dashboards:write') {
                    return false;
                }
                else {
                    return true;
                }
            });
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal('Add panel to new dashboard');
            expect(screen.queryByRole('radio')).not.toBeInTheDocument();
        }));
    });
    describe('Error handling', () => {
        beforeEach(() => {
            mocks.contextSrv.hasPermission.mockImplementation(() => true);
        });
        afterEach(() => {
            jest.restoreAllMocks();
        });
        it('Shows an error if opening a new tab fails', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(global, 'open').mockReturnValue(null);
            const removeDashboardSpy = jest.spyOn(initDashboard, 'removeDashboardToFetchFromLocalStorage');
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.findByRole('alert')).toBeInTheDocument();
            }));
            expect(removeDashboardSpy).toHaveBeenCalled();
        }));
        it('Shows an error if saving to localStorage fails', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(initDashboard, 'setDashboardToFetchFromLocalStorage').mockImplementation(() => {
                throw 'SOME ERROR';
            });
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.findByRole('alert')).toBeInTheDocument();
            }));
        }));
        it('Shows an error if fetching dashboard fails', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(backendSrv, 'getDashboardByUid').mockRejectedValue('SOME ERROR');
            jest.spyOn(backendSrv, 'search').mockResolvedValue([
                {
                    uid: 'someUid',
                    isStarred: false,
                    title: 'Dashboard Title',
                    tags: [],
                    type: DashboardSearchItemType.DashDB,
                    uri: 'someUri',
                    url: 'someUrl',
                },
            ]);
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('radio', { name: /existing dashboard/i }));
            yield userEvent.click(screen.getByRole('combobox', { name: /dashboard/i }));
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                yield screen.findByLabelText('Select option');
            }));
            yield userEvent.click(screen.getByLabelText('Select option'));
            yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.findByRole('alert')).toBeInTheDocument();
            }));
        }));
        it('Shows an error if an unknown error happens', () => __awaiter(void 0, void 0, void 0, function* () {
            jest.spyOn(api, 'setDashboardInLocalStorage').mockRejectedValue('SOME ERROR');
            setup(React.createElement(AddToDashboard, { exploreId: 'left' }));
            yield openModal();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
            yield userEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
            yield waitFor(() => __awaiter(void 0, void 0, void 0, function* () {
                expect(yield screen.findByRole('alert')).toBeInTheDocument();
            }));
        }));
    });
});
//# sourceMappingURL=index.test.js.map