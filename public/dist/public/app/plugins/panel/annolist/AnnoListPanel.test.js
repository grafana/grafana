import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AnnoListPanel } from './AnnoListPanel';
import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { backendSrv } from '../../../core/services/backend_srv';
import userEvent from '@testing-library/user-event';
import { silenceConsoleOutput } from '../../../../test/core/utils/silenceConsoleOutput';
import { setDashboardSrv } from '../../../features/dashboard/services/DashboardSrv';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { getBackendSrv: function () { return backendSrv; } })); });
var defaultOptions = {
    limit: 10,
    navigateAfter: '10m',
    navigateBefore: '20m',
    navigateToPanel: true,
    onlyFromThisDashboard: true,
    onlyInTimeRange: false,
    showTags: true,
    showTime: true,
    showUser: true,
    tags: ['tag A', 'tag B'],
};
var defaultResult = {
    text: 'Result text',
    userId: 1,
    login: 'Result login',
    email: 'Result email',
    avatarUrl: 'Result avatarUrl',
    tags: ['Result tag A', 'Result tag B'],
    time: Date.UTC(2021, 0, 1, 0, 0, 0, 0),
    panelId: 13,
    dashboardId: 14, // deliberately different from panelId
};
function setupTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.options, options = _c === void 0 ? defaultOptions : _c, _d = _b.results, results = _d === void 0 ? [defaultResult] : _d;
    return __awaiter(this, void 0, void 0, function () {
        var getMock, dash, dashSrv, props, rerender;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    jest.clearAllMocks();
                    getMock = jest.spyOn(backendSrv, 'get');
                    getMock.mockResolvedValue(results);
                    dash = { id: 1, formatDate: function (time) { return new Date(time).toISOString(); } };
                    dashSrv = { getCurrent: function () { return dash; } };
                    setDashboardSrv(dashSrv);
                    props = {
                        data: { state: LoadingState.Done, timeRange: getDefaultTimeRange(), series: [] },
                        eventBus: {
                            subscribe: jest.fn(),
                            getStream: function () {
                                return ({
                                    subscribe: jest.fn(),
                                });
                            },
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
                        options: options,
                        renderCounter: 1,
                        replaceVariables: jest.fn(),
                        timeRange: getDefaultTimeRange(),
                        timeZone: 'utc',
                        title: 'Test Title',
                        transparent: false,
                        width: 320,
                    };
                    rerender = render(React.createElement(AnnoListPanel, __assign({}, props))).rerender;
                    return [4 /*yield*/, waitFor(function () { return expect(getMock).toHaveBeenCalledTimes(1); })];
                case 1:
                    _e.sent();
                    return [2 /*return*/, { props: props, rerender: rerender, getMock: getMock }];
            }
        });
    });
}
describe('AnnoListPanel', function () {
    describe('when mounted', function () {
        it('then it should fetch annotations', function () { return __awaiter(void 0, void 0, void 0, function () {
            var getMock;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        getMock = (_a.sent()).getMock;
                        expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                            dashboardId: 1,
                            limit: 10,
                            tags: ['tag A', 'tag B'],
                            type: 'annotation',
                        }, 'anno-list-panel-1');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when there are no annotations', function () {
        it('then it should show a no annotations message', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext({ results: [] })];
                    case 1:
                        _a.sent();
                        expect(screen.getByText(/no annotations found/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when there are annotations', function () {
        it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, setupTestContext()];
                    case 1:
                        _a.sent();
                        expect(screen.queryByText(/no annotations found/i)).not.toBeInTheDocument();
                        expect(screen.queryByText(/result email/i)).not.toBeInTheDocument();
                        expect(screen.getByText(/result text/i)).toBeInTheDocument();
                        expect(screen.getByRole('img')).toBeInTheDocument();
                        expect(screen.getByText('Result tag A')).toBeInTheDocument();
                        expect(screen.getByText('Result tag B')).toBeInTheDocument();
                        expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and login property is missing in annotation', function () {
            it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext({ results: [__assign(__assign({}, defaultResult), { login: undefined })] })];
                        case 1:
                            _a.sent();
                            expect(screen.queryByRole('img')).not.toBeInTheDocument();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            expect(screen.getByText('Result tag A')).toBeInTheDocument();
                            expect(screen.getByText('Result tag B')).toBeInTheDocument();
                            expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and property is missing in annotation', function () {
            it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext({ results: [__assign(__assign({}, defaultResult), { time: undefined })] })];
                        case 1:
                            _a.sent();
                            expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            expect(screen.getByRole('img')).toBeInTheDocument();
                            expect(screen.getByText('Result tag A')).toBeInTheDocument();
                            expect(screen.getByText('Result tag B')).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and show user option is off', function () {
            it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext({
                                options: __assign(__assign({}, defaultOptions), { showUser: false }),
                            })];
                        case 1:
                            _a.sent();
                            expect(screen.queryByRole('img')).not.toBeInTheDocument();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            expect(screen.getByText('Result tag A')).toBeInTheDocument();
                            expect(screen.getByText('Result tag B')).toBeInTheDocument();
                            expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and show time option is off', function () {
            it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext({
                                options: __assign(__assign({}, defaultOptions), { showTime: false }),
                            })];
                        case 1:
                            _a.sent();
                            expect(screen.queryByText(/2021-01-01T00:00:00.000Z/i)).not.toBeInTheDocument();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            expect(screen.getByRole('img')).toBeInTheDocument();
                            expect(screen.getByText('Result tag A')).toBeInTheDocument();
                            expect(screen.getByText('Result tag B')).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and show tags option is off', function () {
            it('then it renders the annotations correctly', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext({
                                options: __assign(__assign({}, defaultOptions), { showTags: false }),
                            })];
                        case 1:
                            _a.sent();
                            expect(screen.queryByText('Result tag A')).not.toBeInTheDocument();
                            expect(screen.queryByText('Result tag B')).not.toBeInTheDocument();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            expect(screen.getByRole('img')).toBeInTheDocument();
                            expect(screen.getByText(/2021-01-01T00:00:00.000Z/i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and the user clicks on the annotation', function () {
            it('then it should navigate to the dashboard connected to the annotation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getMock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext()];
                        case 1:
                            getMock = (_a.sent()).getMock;
                            getMock.mockClear();
                            expect(screen.getByText(/result text/i)).toBeInTheDocument();
                            userEvent.click(screen.getByText(/result text/i));
                            expect(getMock).toHaveBeenCalledTimes(1);
                            expect(getMock).toHaveBeenCalledWith('/api/search', { dashboardIds: 14 });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and the user clicks on a tag', function () {
            it('then it should navigate to the dashboard connected to the annotation', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getMock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext()];
                        case 1:
                            getMock = (_a.sent()).getMock;
                            getMock.mockClear();
                            expect(screen.getByText('Result tag B')).toBeInTheDocument();
                            userEvent.click(screen.getByText('Result tag B'));
                            expect(getMock).toHaveBeenCalledTimes(1);
                            expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                                dashboardId: 1,
                                limit: 10,
                                tags: ['tag A', 'tag B', 'Result tag B'],
                                type: 'annotation',
                            }, 'anno-list-panel-1');
                            expect(screen.getByText(/filter:/i)).toBeInTheDocument();
                            expect(screen.getAllByText(/result tag b/i)).toHaveLength(2);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and the user clicks on the user avatar', function () {
            it('then it should filter annotations by login and the filter should show', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getMock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext()];
                        case 1:
                            getMock = (_a.sent()).getMock;
                            getMock.mockClear();
                            expect(screen.getByRole('img')).toBeInTheDocument();
                            userEvent.click(screen.getByRole('img'));
                            expect(getMock).toHaveBeenCalledTimes(1);
                            expect(getMock).toHaveBeenCalledWith('/api/annotations', {
                                dashboardId: 1,
                                limit: 10,
                                tags: ['tag A', 'tag B'],
                                type: 'annotation',
                                userId: 1,
                            }, 'anno-list-panel-1');
                            expect(screen.getByText(/filter:/i)).toBeInTheDocument();
                            expect(screen.getByText(/result email/i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
        describe('and the user hovers over the user avatar', function () {
            silenceConsoleOutput(); // Popper throws an act error, but if we add act around the hover here it doesn't matter
            it('then it should filter annotations by login', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getMock;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, setupTestContext()];
                        case 1:
                            getMock = (_a.sent()).getMock;
                            getMock.mockClear();
                            expect(screen.getByRole('img')).toBeInTheDocument();
                            userEvent.hover(screen.getByRole('img'));
                            expect(screen.getByText(/result email/i)).toBeInTheDocument();
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
});
//# sourceMappingURL=AnnoListPanel.test.js.map