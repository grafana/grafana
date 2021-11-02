import { __awaiter, __generator } from "tslib";
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { historySrv } from '../VersionHistory/HistorySrv';
import { VersionsSettings, VERSIONS_FETCH_LIMIT } from './VersionsSettings';
import { versions, diffs } from './__mocks__/versions';
jest.mock('../VersionHistory/HistorySrv');
var queryByFullText = function (text) {
    return screen.queryByText(function (_, node) {
        if (node) {
            var nodeHasText_1 = function (node) { var _a; return (_a = node.textContent) === null || _a === void 0 ? void 0 : _a.includes(text); };
            var currentNodeHasText = nodeHasText_1(node);
            var childrenDontHaveText = Array.from(node.children).every(function (child) { return !nodeHasText_1(child); });
            return Boolean(currentNodeHasText && childrenDontHaveText);
        }
        return false;
    });
};
describe('VersionSettings', function () {
    var dashboard = {
        id: 74,
        version: 11,
        formatDate: jest.fn(function () { return 'date'; }),
        getRelativeTime: jest.fn(function () { return 'time ago'; }),
    };
    beforeEach(function () {
        jest.resetAllMocks();
    });
    test('renders a header and a loading indicator followed by results in a table', function () { return __awaiter(void 0, void 0, void 0, function () {
        var tableBodyRows, firstRow;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // @ts-ignore
                    historySrv.getHistoryList.mockResolvedValue(versions);
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(screen.getByRole('heading', { name: /versions/i })).toBeInTheDocument();
                    expect(screen.queryByText(/fetching history list/i)).toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    tableBodyRows = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row');
                    expect(tableBodyRows.length).toBe(versions.length);
                    firstRow = within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')[0];
                    expect(within(firstRow).getByText(/latest/i)).toBeInTheDocument();
                    expect(within(screen.getByRole('table')).getAllByText(/latest/i)).toHaveLength(1);
                    return [2 /*return*/];
            }
        });
    }); });
    test('does not render buttons if versions === 1', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // @ts-ignore
                    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, 1));
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    test('does not render show more button if versions < VERSIONS_FETCH_LIMIT', function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // @ts-ignore
                    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT - 5));
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(screen.queryByRole('button', { name: /show more versions|/i })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /compare versions/i })).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    test('renders buttons if versions >= VERSIONS_FETCH_LIMIT', function () { return __awaiter(void 0, void 0, void 0, function () {
        var compareButton, showMoreButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // @ts-ignore
                    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(screen.queryByRole('button', { name: /show more versions/i })).not.toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /compare versions/i })).not.toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    compareButton = screen.getByRole('button', { name: /compare versions/i });
                    showMoreButton = screen.getByRole('button', { name: /show more versions/i });
                    expect(showMoreButton).toBeInTheDocument();
                    expect(showMoreButton).toBeEnabled();
                    expect(compareButton).toBeInTheDocument();
                    expect(compareButton).toBeDisabled();
                    return [2 /*return*/];
            }
        });
    }); });
    test('clicking show more appends results to the table', function () { return __awaiter(void 0, void 0, void 0, function () {
        var showMoreButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    historySrv.getHistoryList
                        // @ts-ignore
                        .mockImplementationOnce(function () { return Promise.resolve(versions.slice(0, VERSIONS_FETCH_LIMIT)); })
                        .mockImplementationOnce(function () { return Promise.resolve(versions.slice(VERSIONS_FETCH_LIMIT, versions.length)); });
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(historySrv.getHistoryList).toBeCalledTimes(1);
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(VERSIONS_FETCH_LIMIT);
                    showMoreButton = screen.getByRole('button', { name: /show more versions/i });
                    userEvent.click(showMoreButton);
                    expect(historySrv.getHistoryList).toBeCalledTimes(2);
                    expect(screen.queryByText(/Fetching more entries/i)).toBeInTheDocument();
                    return [4 /*yield*/, waitFor(function () {
                            return expect(within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row').length).toBe(versions.length);
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    test('selecting two versions and clicking compare button should render compare view', function () { return __awaiter(void 0, void 0, void 0, function () {
        var compareButton, tableBody, diffGroups;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // @ts-ignore
                    historySrv.getHistoryList.mockResolvedValue(versions.slice(0, VERSIONS_FETCH_LIMIT));
                    historySrv.getDashboardVersion
                        // @ts-ignore
                        .mockImplementationOnce(function () { return Promise.resolve(diffs.lhs); })
                        .mockImplementationOnce(function () { return Promise.resolve(diffs.rhs); });
                    render(React.createElement(VersionsSettings, { dashboard: dashboard }));
                    expect(historySrv.getHistoryList).toBeCalledTimes(1);
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 1:
                    _a.sent();
                    compareButton = screen.getByRole('button', { name: /compare versions/i });
                    tableBody = screen.getAllByRole('rowgroup')[1];
                    userEvent.click(within(tableBody).getAllByRole('checkbox')[0]);
                    userEvent.click(within(tableBody).getAllByRole('checkbox')[VERSIONS_FETCH_LIMIT - 1]);
                    expect(compareButton).toBeEnabled();
                    userEvent.click(within(tableBody).getAllByRole('checkbox')[1]);
                    expect(compareButton).toBeDisabled();
                    userEvent.click(within(tableBody).getAllByRole('checkbox')[1]);
                    userEvent.click(compareButton);
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('heading', { name: /versions comparing 2 11/i })).toBeInTheDocument(); })];
                case 2:
                    _a.sent();
                    expect(queryByFullText('Version 11 updated by admin')).toBeInTheDocument();
                    expect(queryByFullText('Version 2 updated by admin')).toBeInTheDocument();
                    expect(screen.queryByRole('button', { name: /restore to version 2/i })).toBeInTheDocument();
                    expect(screen.queryAllByTestId('diffGroup').length).toBe(5);
                    diffGroups = screen.getAllByTestId('diffGroup');
                    expect(queryByFullText('description added The dashboard description')).toBeInTheDocument();
                    expect(queryByFullText('panels changed')).toBeInTheDocument();
                    expect(within(diffGroups[1]).queryByRole('list')).toBeInTheDocument();
                    expect(within(diffGroups[1]).queryByText(/added title/i)).toBeInTheDocument();
                    expect(within(diffGroups[1]).queryByText(/changed id/i)).toBeInTheDocument();
                    expect(queryByFullText('tags deleted item 0')).toBeInTheDocument();
                    expect(queryByFullText('timepicker added 1 refresh_intervals')).toBeInTheDocument();
                    expect(queryByFullText('version changed')).toBeInTheDocument();
                    expect(screen.queryByText(/view json diff/i)).toBeInTheDocument();
                    userEvent.click(screen.getByText(/view json diff/i));
                    return [4 /*yield*/, waitFor(function () { return expect(screen.getByRole('table')).toBeInTheDocument(); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=VersionsSettings.test.js.map