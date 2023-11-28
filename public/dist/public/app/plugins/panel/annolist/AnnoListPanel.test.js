import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { backendSrv } from '../../../core/services/backend_srv';
import { setDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
import { AnnoListPanel } from './AnnoListPanel';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: () => backendSrv })));
const defaultOptions = {
    limit: 10,
    navigateAfter: '10m',
    navigateBefore: '10m',
    navigateToPanel: true,
    onlyFromThisDashboard: true,
    onlyInTimeRange: false,
    showTags: true,
    showTime: true,
    showUser: true,
    tags: ['tag A', 'tag B'],
};
const defaultResult = {
    text: 'Result text',
    userId: 1,
    login: 'Result login',
    email: 'Result email',
    avatarUrl: 'Result avatarUrl',
    tags: ['Result tag A', 'Result tag B'],
    time: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
    panelId: 13,
    dashboardId: 14,
    id: 14,
    uid: '7MeksYbmk',
    dashboardUID: '7MeksYbmk',
    url: '/d/asdkjhajksd/some-dash',
};
function setupTestContext({ options = defaultOptions, results = [defaultResult], } = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        jest.clearAllMocks();
        const getMock = jest.spyOn(backendSrv, 'get');
        getMock.mockResolvedValue(results);
        const dash = { uid: 'srx16xR4z', formatDate: (time) => new Date(time).toISOString() };
        const dashSrv = { getCurrent: () => dash };
        setDashboardSrv(dashSrv);
        const pushSpy = jest.spyOn(locationService, 'push');
        const props = {
            data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
            eventBus: {
                subscribe: jest.fn(),
                getStream: () => ({
                    subscribe: jest.fn(),
                }),
                publish: jest.fn(),
                removeAllListeners: jest.fn(),
                newScopedBus: jest.fn(),
            },
            fieldConfig: {},
            height: 400,
            id: 1,
            onChangeTimeRange: jest.fn(),
            onFieldConfigChange: jest.fn(),
            onOptionsChange: jest.fn(),
            options,
            renderCounter: 1,
            replaceVariables: (str) => str,
            timeRange: getDefaultTimeRange(),
            timeZone: 'utc',
            title: 'Test Title',
            transparent: false,
            width: 320,
        };
        const { rerender } = render(React.createElement(AnnoListPanel, Object.assign({}, props)));
        yield waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
        return { props, rerender, getMock, pushSpy };
    });
}
describe('AnnoListPanel', () => {
    describe('when mounted', () => {
        it('then it should fetch annotations', () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock } = yield setupTestContext();
            expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                dashboardUID: 'srx16xR4z',
                limit: 10,
                tags: ['tag A', 'tag B'],
                type: 'annotation',
            }, 'anno-list-panel-1');
        }));
    });
    describe('when there are no annotations', () => {
        it('then it should show a no annotations message', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext({ results: [] });
            expect(screen.getByText(/no annotations found/i)).toBeInTheDocument();
        }));
    });
    describe('when there are annotations', () => {
        it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            yield setupTestContext();
            expect(screen.queryByText(/no annotations found/i)).not.toBeInTheDocument();
            expect(screen.queryByText(/result email/i)).not.toBeInTheDocument();
            expect(screen.getByText(/result text/i)).toBeInTheDocument();
            expect(screen.getByRole('img')).toBeInTheDocument();
            expect(screen.getByText('Result tag A')).toBeInTheDocument();
            expect(screen.getByText('Result tag B')).toBeInTheDocument();
            expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
        }));
        it("renders annotation item's html content", () => __awaiter(void 0, void 0, void 0, function* () {
            const { getMock } = yield setupTestContext({
                results: [Object.assign(Object.assign({}, defaultResult), { text: '<a href="">test link </a> ' })],
            });
            getMock.mockClear();
            expect(screen.getByRole('link')).toBeInTheDocument();
            expect(getMock).not.toHaveBeenCalled();
        }));
        describe('and login property is missing in annotation', () => {
            it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
                yield setupTestContext({ results: [Object.assign(Object.assign({}, defaultResult), { login: undefined })] });
                expect(screen.queryByRole('img')).not.toBeInTheDocument();
                expect(screen.getByText(/result text/i)).toBeInTheDocument();
                expect(screen.getByText('Result tag A')).toBeInTheDocument();
                expect(screen.getByText('Result tag B')).toBeInTheDocument();
                expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
            }));
        });
        describe('and property is missing in annotation', () => {
            it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
                yield setupTestContext({ results: [Object.assign(Object.assign({}, defaultResult), { time: undefined })] });
                expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
                expect(screen.getByText(/result text/i)).toBeInTheDocument();
                expect(screen.getByRole('img')).toBeInTheDocument();
                expect(screen.getByText('Result tag A')).toBeInTheDocument();
                expect(screen.getByText('Result tag B')).toBeInTheDocument();
            }));
        });
        describe('and show user option is off', () => {
            it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
                yield setupTestContext({
                    options: Object.assign(Object.assign({}, defaultOptions), { showUser: false }),
                });
                expect(screen.queryByRole('img')).not.toBeInTheDocument();
                expect(screen.getByText(/result text/i)).toBeInTheDocument();
                expect(screen.getByText('Result tag A')).toBeInTheDocument();
                expect(screen.getByText('Result tag B')).toBeInTheDocument();
                expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
            }));
        });
        describe('and show time option is off', () => {
            it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
                yield setupTestContext({
                    options: Object.assign(Object.assign({}, defaultOptions), { showTime: false }),
                });
                expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
                expect(screen.getByText(/result text/i)).toBeInTheDocument();
                expect(screen.getByRole('img')).toBeInTheDocument();
                expect(screen.getByText('Result tag A')).toBeInTheDocument();
                expect(screen.getByText('Result tag B')).toBeInTheDocument();
            }));
        });
        describe('and show tags option is off', () => {
            it('then it renders the annotations correctly', () => __awaiter(void 0, void 0, void 0, function* () {
                yield setupTestContext({
                    options: Object.assign(Object.assign({}, defaultOptions), { showTags: false }),
                });
                expect(screen.queryByText('Result tag A')).not.toBeInTheDocument();
                expect(screen.queryByText('Result tag B')).not.toBeInTheDocument();
                expect(screen.getByText(/result text/i)).toBeInTheDocument();
                expect(screen.getByRole('img')).toBeInTheDocument();
                expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
            }));
        });
        describe('and the user clicks on the annotation', () => {
            it('then it should navigate to the dashboard connected to the annotation', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getMock, pushSpy } = yield setupTestContext();
                getMock.mockClear();
                expect(screen.getByRole('button', { name: /result text/i })).toBeInTheDocument();
                yield userEvent.click(screen.getByRole('button', { name: /result text/i }));
                yield waitFor(() => expect(getMock).toHaveBeenCalledTimes(1));
                expect(getMock).toHaveBeenCalledWith('/api/search', { dashboardUIDs: '7MeksYbmk' });
                expect(pushSpy).toHaveBeenCalledTimes(1);
                expect(pushSpy).toHaveBeenCalledWith('/d/asdkjhajksd/some-dash?from=1609458600000&to=1609459800000');
            }));
        });
        describe('and the user clicks on a tag', () => {
            it('then it should navigate to the dashboard connected to the annotation', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getMock } = yield setupTestContext();
                getMock.mockClear();
                expect(screen.getByRole('button', { name: /result tag b/i })).toBeInTheDocument();
                yield userEvent.click(screen.getByRole('button', { name: /result tag b/i }));
                expect(getMock).toHaveBeenCalledTimes(1);
                expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                    dashboardUID: 'srx16xR4z',
                    limit: 10,
                    tags: ['tag A', 'tag B', 'Result tag B'],
                    type: 'annotation',
                }, 'anno-list-panel-1');
                expect(screen.getByText(/filter:/i)).toBeInTheDocument();
                expect(screen.getAllByText(/result tag b/i)).toHaveLength(2);
            }));
        });
        describe('and the user clicks on the user avatar', () => {
            it('then it should filter annotations by login and the filter should show', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getMock } = yield setupTestContext();
                getMock.mockClear();
                expect(screen.getByRole('img')).toBeInTheDocument();
                yield userEvent.click(screen.getByRole('img'));
                expect(getMock).toHaveBeenCalledTimes(1);
                expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                    dashboardUID: 'srx16xR4z',
                    limit: 10,
                    tags: ['tag A', 'tag B'],
                    type: 'annotation',
                    userId: 1,
                }, 'anno-list-panel-1');
                expect(screen.getByText(/filter:/i)).toBeInTheDocument();
                expect(screen.getByText(/result email/i)).toBeInTheDocument();
            }));
        });
        describe('and the user hovers over the user avatar', () => {
            silenceConsoleOutput(); // Popper throws an act error, but if we add act around the hover here it doesn't matter
            it('then it should filter annotations by login', () => __awaiter(void 0, void 0, void 0, function* () {
                const { getMock } = yield setupTestContext();
                getMock.mockClear();
                expect(screen.getByRole('img')).toBeInTheDocument();
            }));
        });
    });
});
//# sourceMappingURL=AnnoListPanel.test.js.map