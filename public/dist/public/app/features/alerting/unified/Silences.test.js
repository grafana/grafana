import { __awaiter, __generator } from "tslib";
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { fetchSilences, fetchAlerts, createOrUpdateSilence } from './api/alertmanager';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { configureStore } from 'app/store/configureStore';
import Silences from './Silences';
import { mockAlertmanagerAlert, mockDataSource, MockDataSourceSrv, mockSilence } from './mocks';
import { DataSourceType } from './utils/datasource';
import { parseMatchers } from './utils/alertmanager';
import { AlertState, MatcherOperator } from 'app/plugins/datasource/alertmanager/types';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';
import userEvent from '@testing-library/user-event';
jest.mock('./api/alertmanager');
var mocks = {
    api: {
        fetchSilences: typeAsJestMock(fetchSilences),
        fetchAlerts: typeAsJestMock(fetchAlerts),
        createOrUpdateSilence: typeAsJestMock(createOrUpdateSilence),
    },
};
var renderSilences = function (location) {
    if (location === void 0) { location = '/alerting/silences/'; }
    var store = configureStore();
    locationService.push(location);
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Silences, null))));
};
var dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
        type: DataSourceType.Alertmanager,
    }),
};
var ui = {
    silencesTable: byTestId('dynamic-table'),
    silenceRow: byTestId('row'),
    silencedAlertCell: byTestId('alerts'),
    queryBar: byPlaceholderText('Search'),
    editor: {
        timeRange: byLabelText('Timepicker', { exact: false }),
        durationField: byLabelText('Duration'),
        durationInput: byRole('textbox', { name: /duration/i }),
        matchersField: byTestId('matcher'),
        matcherName: byPlaceholderText('label'),
        matcherValue: byPlaceholderText('value'),
        comment: byPlaceholderText('Details about the silence'),
        createdBy: byPlaceholderText('User'),
        matcherOperatorSelect: byLabelText('operator'),
        matcherOperator: function (operator) { return byText(operator, { exact: true }); },
        addMatcherButton: byRole('button', { name: 'Add matcher' }),
        submit: byText('Submit'),
    },
};
var resetMocks = function () {
    jest.resetAllMocks();
    mocks.api.fetchSilences.mockImplementation(function () {
        return Promise.resolve([
            mockSilence({ id: '12345' }),
            mockSilence({ id: '67890', matchers: parseMatchers('foo!=bar'), comment: 'Catch all' }),
        ]);
    });
    mocks.api.fetchAlerts.mockImplementation(function () {
        return Promise.resolve([
            mockAlertmanagerAlert({
                labels: { foo: 'bar' },
                status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
            }),
            mockAlertmanagerAlert({
                labels: { foo: 'buzz' },
                status: { state: AlertState.Suppressed, silencedBy: ['67890'], inhibitedBy: [] },
            }),
        ]);
    });
    mocks.api.createOrUpdateSilence.mockResolvedValue(mockSilence());
};
describe('Silences', function () {
    beforeAll(resetMocks);
    afterEach(resetMocks);
    beforeEach(function () {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
    });
    it('loads and shows silences', function () { return __awaiter(void 0, void 0, void 0, function () {
        var silences;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderSilences();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchSilences).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlerts).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    expect(ui.silencesTable.query()).not.toBeNull();
                    silences = ui.silenceRow.queryAll();
                    expect(silences).toHaveLength(2);
                    expect(silences[0]).toHaveTextContent('foo=bar');
                    expect(silences[1]).toHaveTextContent('foo!=bar');
                    return [2 /*return*/];
            }
        });
    }); });
    it('shows the correct number of silenced alerts', function () { return __awaiter(void 0, void 0, void 0, function () {
        var silencedAlertRows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchAlerts.mockImplementation(function () {
                        return Promise.resolve([
                            mockAlertmanagerAlert({
                                labels: { foo: 'bar', buzz: 'bazz' },
                                status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
                            }),
                            mockAlertmanagerAlert({
                                labels: { foo: 'bar', buzz: 'bazz' },
                                status: { state: AlertState.Suppressed, silencedBy: ['12345'], inhibitedBy: [] },
                            }),
                        ]);
                    });
                    renderSilences();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchSilences).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlerts).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    silencedAlertRows = ui.silencedAlertCell.getAll(ui.silencesTable.get());
                    expect(silencedAlertRows).toHaveLength(2);
                    expect(silencedAlertRows[0]).toHaveTextContent('2');
                    expect(silencedAlertRows[1]).toHaveTextContent('0');
                    return [2 /*return*/];
            }
        });
    }); });
    it('filters silences by matchers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var queryBar;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderSilences();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchSilences).toHaveBeenCalled(); })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlerts).toHaveBeenCalled(); })];
                case 2:
                    _a.sent();
                    queryBar = ui.queryBar.get();
                    userEvent.paste(queryBar, 'foo=bar');
                    return [4 /*yield*/, waitFor(function () { return expect(ui.silenceRow.getAll()).toHaveLength(1); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
describe('Silence edit', function () {
    var baseUrlPath = '/alerting/silence/new';
    beforeAll(resetMocks);
    afterEach(resetMocks);
    beforeEach(function () {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
    });
    it('prefills the matchers field with matchers params', function () { return __awaiter(void 0, void 0, void 0, function () {
        var matchers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderSilences(baseUrlPath + "?matchers=" + encodeURIComponent('foo=bar,bar=~ba.+,hello!=world,cluster!~us-central.*'));
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editor.durationField.query()).not.toBeNull(); })];
                case 1:
                    _a.sent();
                    matchers = ui.editor.matchersField.queryAll();
                    expect(matchers).toHaveLength(4);
                    expect(ui.editor.matcherName.query(matchers[0])).toHaveValue('foo');
                    expect(ui.editor.matcherOperator(MatcherOperator.equal).query(matchers[0])).not.toBeNull();
                    expect(ui.editor.matcherValue.query(matchers[0])).toHaveValue('bar');
                    expect(ui.editor.matcherName.query(matchers[1])).toHaveValue('bar');
                    expect(ui.editor.matcherOperator(MatcherOperator.regex).query(matchers[1])).not.toBeNull();
                    expect(ui.editor.matcherValue.query(matchers[1])).toHaveValue('ba.+');
                    expect(ui.editor.matcherName.query(matchers[2])).toHaveValue('hello');
                    expect(ui.editor.matcherOperator(MatcherOperator.notEqual).query(matchers[2])).not.toBeNull();
                    expect(ui.editor.matcherValue.query(matchers[2])).toHaveValue('world');
                    expect(ui.editor.matcherName.query(matchers[3])).toHaveValue('cluster');
                    expect(ui.editor.matcherOperator(MatcherOperator.notRegex).query(matchers[3])).not.toBeNull();
                    expect(ui.editor.matcherValue.query(matchers[3])).toHaveValue('us-central.*');
                    return [2 /*return*/];
            }
        });
    }); });
    it('creates a new silence', function () { return __awaiter(void 0, void 0, void 0, function () {
        var start, end, startDateString, endDateString;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    renderSilences(baseUrlPath);
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editor.durationField.query()).not.toBeNull(); })];
                case 1:
                    _a.sent();
                    start = new Date();
                    end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
                    startDateString = dateTime(start).format('YYYY-MM-DD');
                    endDateString = dateTime(end).format('YYYY-MM-DD');
                    userEvent.clear(ui.editor.durationInput.get());
                    userEvent.type(ui.editor.durationInput.get(), '1d');
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editor.durationInput.query()).toHaveValue('1d'); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editor.timeRange.get()).toHaveTextContent(startDateString); })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editor.timeRange.get()).toHaveTextContent(endDateString); })];
                case 4:
                    _a.sent();
                    userEvent.type(ui.editor.matcherName.get(), 'foo');
                    userEvent.type(ui.editor.matcherOperatorSelect.get(), '=');
                    userEvent.tab();
                    userEvent.type(ui.editor.matcherValue.get(), 'bar');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.editor.matcherName.getAll()[1], 'bar');
                    userEvent.type(ui.editor.matcherOperatorSelect.getAll()[1], '!=');
                    userEvent.tab();
                    userEvent.type(ui.editor.matcherValue.getAll()[1], 'buzz');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.editor.matcherName.getAll()[2], 'region');
                    userEvent.type(ui.editor.matcherOperatorSelect.getAll()[2], '=~');
                    userEvent.tab();
                    userEvent.type(ui.editor.matcherValue.getAll()[2], 'us-west-.*');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.editor.addMatcherButton.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.editor.matcherName.getAll()[3], 'env');
                    userEvent.type(ui.editor.matcherOperatorSelect.getAll()[3], '!~');
                    userEvent.tab();
                    userEvent.type(ui.editor.matcherValue.getAll()[3], 'dev|staging');
                    userEvent.type(ui.editor.comment.get(), 'Test');
                    userEvent.type(ui.editor.createdBy.get(), 'Homer Simpson');
                    userEvent.click(ui.editor.submit.get());
                    return [4 /*yield*/, waitFor(function () {
                            return expect(mocks.api.createOrUpdateSilence).toHaveBeenCalledWith('grafana', expect.objectContaining({
                                comment: 'Test',
                                createdBy: 'Homer Simpson',
                                matchers: [
                                    { isEqual: true, isRegex: false, name: 'foo', value: 'bar' },
                                    { isEqual: false, isRegex: false, name: 'bar', value: 'buzz' },
                                    { isEqual: true, isRegex: true, name: 'region', value: 'us-west-.*' },
                                    { isEqual: false, isRegex: true, name: 'env', value: 'dev|staging' },
                                ],
                            }));
                        })];
                case 5:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=Silences.test.js.map