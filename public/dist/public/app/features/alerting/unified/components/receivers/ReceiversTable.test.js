import { __awaiter, __generator } from "tslib";
import React from 'react';
import { render } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { ReceiversTable } from './ReceiversTable';
import { fetchGrafanaNotifiersAction } from '../../state/actions';
import { byRole } from 'testing-library-selector';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
var renderReceieversTable = function (receivers, notifiers) { return __awaiter(void 0, void 0, void 0, function () {
    var config, store;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                config = {
                    template_files: {},
                    alertmanager_config: {
                        receivers: receivers,
                    },
                };
                store = configureStore();
                return [4 /*yield*/, store.dispatch(fetchGrafanaNotifiersAction.fulfilled(notifiers, 'initial'))];
            case 1:
                _a.sent();
                return [2 /*return*/, render(React.createElement(Provider, { store: store },
                        React.createElement(Router, { history: locationService.getHistory() },
                            React.createElement(ReceiversTable, { config: config, alertManagerName: "alertmanager-1" }))))];
        }
    });
}); };
var mockGrafanaReceiver = function (type) { return ({
    type: type,
    disableResolveMessage: false,
    secureFields: {},
    settings: {},
    name: type,
}); };
var mockNotifier = function (type, name) { return ({
    type: type,
    name: name,
    description: 'its a mock',
    heading: 'foo',
    options: [],
}); };
var ui = {
    table: byRole('table'),
};
describe('ReceiversTable', function () {
    it('render receivers with grafana notifiers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receivers, notifiers, table, rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    receivers = [
                        {
                            name: 'with receivers',
                            grafana_managed_receiver_configs: [mockGrafanaReceiver('googlechat'), mockGrafanaReceiver('sensugo')],
                        },
                        {
                            name: 'without receivers',
                            grafana_managed_receiver_configs: [],
                        },
                    ];
                    notifiers = [mockNotifier('googlechat', 'Google Chat'), mockNotifier('sensugo', 'Sensu Go')];
                    return [4 /*yield*/, renderReceieversTable(receivers, notifiers)];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, ui.table.find()];
                case 2:
                    table = _b.sent();
                    rows = (_a = table.querySelector('tbody')) === null || _a === void 0 ? void 0 : _a.querySelectorAll('tr');
                    expect(rows).toHaveLength(2);
                    expect(rows[0].querySelectorAll('td')[0]).toHaveTextContent('with receivers');
                    expect(rows[0].querySelectorAll('td')[1]).toHaveTextContent('Google Chat, Sensu Go');
                    expect(rows[1].querySelectorAll('td')[0]).toHaveTextContent('without receivers');
                    expect(rows[1].querySelectorAll('td')[1].textContent).toEqual('');
                    return [2 /*return*/];
            }
        });
    }); });
    it('render receivers with alertmanager notifers', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receivers, table, rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    receivers = [
                        {
                            name: 'with receivers',
                            email_configs: [
                                {
                                    to: 'domas.lapinskas@grafana.com',
                                },
                            ],
                            slack_configs: [],
                            webhook_configs: [
                                {
                                    url: 'http://example.com',
                                },
                            ],
                            opsgenie_configs: [
                                {
                                    foo: 'bar',
                                },
                            ],
                            foo_configs: [
                                {
                                    url: 'bar',
                                },
                            ],
                        },
                        {
                            name: 'without receivers',
                        },
                    ];
                    return [4 /*yield*/, renderReceieversTable(receivers, [])];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, ui.table.find()];
                case 2:
                    table = _b.sent();
                    rows = (_a = table.querySelector('tbody')) === null || _a === void 0 ? void 0 : _a.querySelectorAll('tr');
                    expect(rows).toHaveLength(2);
                    expect(rows[0].querySelectorAll('td')[0]).toHaveTextContent('with receivers');
                    expect(rows[0].querySelectorAll('td')[1]).toHaveTextContent('Email, Webhook, OpsGenie, Foo');
                    expect(rows[1].querySelectorAll('td')[0]).toHaveTextContent('without receivers');
                    expect(rows[1].querySelectorAll('td')[1].textContent).toEqual('');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=ReceiversTable.test.js.map