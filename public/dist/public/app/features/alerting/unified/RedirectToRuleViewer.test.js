import { __assign } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { locationService } from '@grafana/runtime';
import { RedirectToRuleViewer } from './RedirectToRuleViewer';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from '../../../../test/helpers/typeAsJestMock';
import { useCombinedRulesMatching } from './hooks/useCombinedRule';
import { PromRuleType } from '../../../types/unified-alerting-dto';
import { getRulesSourceByName } from './utils/datasource';
jest.mock('./hooks/useCombinedRule');
jest.mock('./utils/datasource');
jest.mock('react-router-dom', function () { return (__assign(__assign({}, jest.requireActual('react-router-dom')), { Redirect: jest.fn(function (_a) { return "Redirected"; }) })); });
var store = configureStore();
var renderRedirectToRuleViewer = function () {
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(RedirectToRuleViewer, __assign({}, mockRoute('prom alert', 'test prom'))))));
};
var mockRuleSourceByName = function () {
    typeAsJestMock(getRulesSourceByName).mockReturnValue({
        name: 'prom test',
        type: 'prometheus',
        uid: 'asdf23',
        id: 1,
        meta: {},
        jsonData: {},
        access: 'proxy',
    });
};
describe('Redirect to Rule viewer', function () {
    it('should list rules that match the same name', function () {
        typeAsJestMock(useCombinedRulesMatching).mockReturnValue({
            result: mockedRules,
            loading: false,
            dispatched: true,
            requestId: 'A',
            error: undefined,
        });
        mockRuleSourceByName();
        renderRedirectToRuleViewer();
        expect(screen.getAllByText('Cloud test alert')).toHaveLength(2);
    });
    it('should redirect to view rule page if only one match', function () {
        typeAsJestMock(useCombinedRulesMatching).mockReturnValue({
            result: [mockedRules[0]],
            loading: false,
            dispatched: true,
            requestId: 'A',
            error: undefined,
        });
        mockRuleSourceByName();
        renderRedirectToRuleViewer();
        expect(screen.getByText('Redirected')).toBeInTheDocument();
    });
});
var mockedRules = [
    {
        name: 'Cloud test alert',
        labels: {},
        query: 'up == 0',
        annotations: {},
        group: {
            name: 'test',
            rules: [],
        },
        promRule: {
            health: 'ok',
            name: 'cloud up alert',
            query: 'up == 0',
            type: PromRuleType.Alerting,
        },
        namespace: {
            name: 'prom test alerts',
            groups: [],
            rulesSource: {
                name: 'prom test',
                type: 'prometheus',
                uid: 'asdf23',
                id: 1,
                meta: {},
                jsonData: {},
                access: 'proxy',
            },
        },
    },
    {
        name: 'Cloud test alert',
        labels: {},
        query: 'up == 0',
        annotations: {},
        group: {
            name: 'test',
            rules: [],
        },
        promRule: {
            health: 'ok',
            name: 'cloud up alert',
            query: 'up == 0',
            type: PromRuleType.Alerting,
        },
        namespace: {
            name: 'prom test alerts',
            groups: [],
            rulesSource: {
                name: 'prom test',
                type: 'prometheus',
                uid: 'asdf23',
                id: 1,
                meta: {},
                jsonData: {},
                access: 'proxy',
            },
        },
    },
];
var mockRoute = function (ruleName, sourceName) {
    return {
        route: {
            path: '/',
            component: RedirectToRuleViewer,
        },
        queryParams: { returnTo: '/alerting/list' },
        match: { params: { name: ruleName, sourceName: sourceName }, isExact: false, url: 'asdf', path: '' },
        history: locationService.getHistory(),
        location: { pathname: '', hash: '', search: '', state: '' },
        staticContext: {},
    };
};
//# sourceMappingURL=RedirectToRuleViewer.test.js.map