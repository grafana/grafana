import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { PluginType } from '@grafana/data';
import { LibraryPanelsSearch } from './LibraryPanelsSearch';
import * as api from '../../state/api';
import { LibraryElementKind } from '../../types';
import { backendSrv } from '../../../../core/services/backend_srv';
import * as panelUtils from '../../../panel/state/util';
jest.mock('@grafana/runtime', function () { return (__assign(__assign({}, jest.requireActual('@grafana/runtime')), { config: {
        panels: {
            timeseries: {
                info: { logos: { small: '' } },
                name: 'Time Series',
            },
        },
    } })); });
jest.mock('debounce-promise', function () {
    var debounce = function (fn) {
        var debounced = function () {
            return Promise.resolve([
                { label: 'General', value: { id: 0, title: 'General' } },
                { label: 'Folder1', value: { id: 1, title: 'Folder1' } },
                { label: 'Folder2', value: { id: 2, title: 'Folder2' } },
            ]);
        };
        return debounced;
    };
    return debounce;
});
function getTestContext(propOverrides, searchResult) {
    if (propOverrides === void 0) { propOverrides = {}; }
    if (searchResult === void 0) { searchResult = { elements: [], perPage: 40, page: 1, totalCount: 0 }; }
    return __awaiter(this, void 0, void 0, function () {
        var pluginInfo, graph, timeseries, getSpy, getLibraryPanelsSpy, getAllPanelPluginMetaSpy, props, rerender;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    jest.clearAllMocks();
                    pluginInfo = { logos: { small: '', large: '' } };
                    graph = {
                        name: 'Graph',
                        id: 'graph',
                        info: pluginInfo,
                        baseUrl: '',
                        type: PluginType.panel,
                        module: '',
                        sort: 0,
                    };
                    timeseries = {
                        name: 'Time Series',
                        id: 'timeseries',
                        info: pluginInfo,
                        baseUrl: '',
                        type: PluginType.panel,
                        module: '',
                        sort: 1,
                    };
                    getSpy = jest
                        .spyOn(backendSrv, 'get')
                        .mockResolvedValue({ sortOptions: [{ displaName: 'Desc', name: 'alpha-desc' }] });
                    getLibraryPanelsSpy = jest.spyOn(api, 'getLibraryPanels').mockResolvedValue(searchResult);
                    getAllPanelPluginMetaSpy = jest.spyOn(panelUtils, 'getAllPanelPluginMeta').mockReturnValue([graph, timeseries]);
                    props = {
                        onClick: jest.fn(),
                    };
                    Object.assign(props, propOverrides);
                    rerender = render(React.createElement(LibraryPanelsSearch, __assign({}, props))).rerender;
                    return [4 /*yield*/, waitFor(function () { return expect(getLibraryPanelsSpy).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1);
                    return [2 /*return*/, { rerender: rerender, getLibraryPanelsSpy: getLibraryPanelsSpy, getSpy: getSpy, getAllPanelPluginMetaSpy: getAllPanelPluginMetaSpy }];
            }
        });
    });
}
describe('LibraryPanelsSearch', function () {
    describe('when mounted with default options', function () {
        it('should show input filter and library panels view', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext()];
                    case 1:
                        _a.sent();
                        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
                        expect(screen.getByText(/no library panels found./i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and user searches for library panel by name or description', function () {
            it('should call api with correct params', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getLibraryPanelsSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext()];
                        case 1:
                            getLibraryPanelsSpy = (_a.sent()).getLibraryPanelsSpy;
                            getLibraryPanelsSpy.mockClear();
                            userEvent.type(screen.getByPlaceholderText(/search by name/i), 'a');
                            return [4 /*yield*/, waitFor(function () { return expect(getLibraryPanelsSpy).toHaveBeenCalled(); })];
                        case 2:
                            _a.sent();
                            expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1);
                            expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
                                searchString: 'a',
                                folderFilter: [],
                                page: 0,
                                typeFilter: [],
                                perPage: 40,
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when mounted with showSort', function () {
        it('should show input filter and library panels view and sort', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ showSort: true })];
                    case 1:
                        _a.sent();
                        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
                        expect(screen.getByText(/no library panels found./i)).toBeInTheDocument();
                        expect(screen.getByText(/sort \(default a–z\)/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and user changes sorting', function () {
            it('should call api with correct params', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getLibraryPanelsSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ showSort: true })];
                        case 1:
                            getLibraryPanelsSpy = (_a.sent()).getLibraryPanelsSpy;
                            getLibraryPanelsSpy.mockClear();
                            userEvent.type(screen.getByText(/sort \(default a–z\)/i), 'Desc{enter}');
                            return [4 /*yield*/, waitFor(function () { return expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _a.sent();
                            expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
                                searchString: '',
                                sortDirection: 'alpha-desc',
                                folderFilter: [],
                                page: 0,
                                typeFilter: [],
                                perPage: 40,
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when mounted with showPanelFilter', function () {
        it('should show input filter and library panels view and panel filter', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ showPanelFilter: true })];
                    case 1:
                        _a.sent();
                        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
                        expect(screen.getByText(/no library panels found./i)).toBeInTheDocument();
                        expect(screen.getByRole('textbox', { name: /panel type filter/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and user changes panel filter', function () {
            it('should call api with correct params', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getLibraryPanelsSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ showPanelFilter: true })];
                        case 1:
                            getLibraryPanelsSpy = (_a.sent()).getLibraryPanelsSpy;
                            getLibraryPanelsSpy.mockClear();
                            userEvent.type(screen.getByRole('textbox', { name: /panel type filter/i }), 'Graph{enter}');
                            userEvent.type(screen.getByRole('textbox', { name: /panel type filter/i }), 'Time Series{enter}');
                            return [4 /*yield*/, waitFor(function () { return expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _a.sent();
                            expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
                                searchString: '',
                                folderFilter: [],
                                page: 0,
                                typeFilter: ['graph', 'timeseries'],
                                perPage: 40,
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when mounted with showPanelFilter', function () {
        it('should show input filter and library panels view and folder filter', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ showFolderFilter: true })];
                    case 1:
                        _a.sent();
                        expect(screen.getByPlaceholderText(/search by name/i)).toBeInTheDocument();
                        expect(screen.getByText(/no library panels found./i)).toBeInTheDocument();
                        expect(screen.getByRole('textbox', { name: /folder filter/i })).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
        describe('and user changes folder filter', function () {
            it('should call api with correct params', function () { return __awaiter(void 0, void 0, void 0, function () {
                var getLibraryPanelsSpy;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, getTestContext({ showFolderFilter: true })];
                        case 1:
                            getLibraryPanelsSpy = (_a.sent()).getLibraryPanelsSpy;
                            getLibraryPanelsSpy.mockClear();
                            userEvent.click(screen.getByRole('textbox', { name: /folder filter/i }));
                            userEvent.type(screen.getByRole('textbox', { name: /folder filter/i }), '{enter}', {
                                skipClick: true,
                            });
                            return [4 /*yield*/, waitFor(function () { return expect(getLibraryPanelsSpy).toHaveBeenCalledTimes(1); })];
                        case 2:
                            _a.sent();
                            expect(getLibraryPanelsSpy).toHaveBeenCalledWith({
                                searchString: '',
                                folderFilter: ['0'],
                                page: 0,
                                typeFilter: [],
                                perPage: 40,
                            });
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('when mounted without showSecondaryActions and there is one panel', function () {
        it('should show correct row and no delete button', function () { return __awaiter(void 0, void 0, void 0, function () {
            var card;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({}, {
                            page: 1,
                            totalCount: 1,
                            perPage: 40,
                            elements: [
                                {
                                    id: 1,
                                    name: 'Library Panel Name',
                                    kind: LibraryElementKind.Panel,
                                    uid: 'uid',
                                    description: 'Library Panel Description',
                                    folderId: 0,
                                    model: { type: 'timeseries', title: 'A title' },
                                    type: 'timeseries',
                                    orgId: 1,
                                    version: 1,
                                    meta: {
                                        folderName: 'General',
                                        folderUid: '',
                                        connectedDashboards: 0,
                                        created: '2021-01-01 12:00:00',
                                        createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                                        updated: '2021-01-01 12:00:00',
                                        updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
                                    },
                                },
                            ],
                        })];
                    case 1:
                        _a.sent();
                        card = function () { return screen.getByLabelText(/plugin visualization item time series/i); };
                        expect(screen.queryByText(/no library panels found./i)).not.toBeInTheDocument();
                        expect(card()).toBeInTheDocument();
                        expect(within(card()).getByText(/library panel name/i)).toBeInTheDocument();
                        expect(within(card()).getByText(/library panel description/i)).toBeInTheDocument();
                        expect(within(card()).queryByLabelText(/delete button on panel type card/i)).not.toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
    describe('when mounted with showSecondaryActions and there is one panel', function () {
        it('should show correct row and delete button', function () { return __awaiter(void 0, void 0, void 0, function () {
            var card;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getTestContext({ showSecondaryActions: true }, {
                            page: 1,
                            totalCount: 1,
                            perPage: 40,
                            elements: [
                                {
                                    id: 1,
                                    name: 'Library Panel Name',
                                    kind: LibraryElementKind.Panel,
                                    uid: 'uid',
                                    description: 'Library Panel Description',
                                    folderId: 0,
                                    model: { type: 'timeseries', title: 'A title' },
                                    type: 'timeseries',
                                    orgId: 1,
                                    version: 1,
                                    meta: {
                                        folderName: 'General',
                                        folderUid: '',
                                        connectedDashboards: 0,
                                        created: '2021-01-01 12:00:00',
                                        createdBy: { id: 1, name: 'Admin', avatarUrl: '' },
                                        updated: '2021-01-01 12:00:00',
                                        updatedBy: { id: 1, name: 'Admin', avatarUrl: '' },
                                    },
                                },
                            ],
                        })];
                    case 1:
                        _a.sent();
                        card = function () { return screen.getByLabelText(/plugin visualization item time series/i); };
                        expect(screen.queryByText(/no library panels found./i)).not.toBeInTheDocument();
                        expect(card()).toBeInTheDocument();
                        expect(within(card()).getByText(/library panel name/i)).toBeInTheDocument();
                        expect(within(card()).getByText(/library panel description/i)).toBeInTheDocument();
                        expect(within(card()).getByLabelText(/delete button on panel type card/i)).toBeInTheDocument();
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=LibraryPanelsSearch.test.js.map