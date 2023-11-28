import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { of } from 'rxjs';
import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { dateTime, PluginType } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { JaegerDatasource } from '../datasource';
import { testResponse } from '../testResponse';
import SearchForm from './SearchForm';
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getTemplateSrv: () => ({
        replace: jest.fn(),
        containsTemplate: (val) => {
            return val.includes('$');
        },
    }) })));
describe('SearchForm', () => {
    it('should call the `onChange` function on click of the Input', () => __awaiter(void 0, void 0, void 0, function* () {
        const promise = Promise.resolve();
        const handleOnChange = jest.fn(() => promise);
        const query = Object.assign(Object.assign({}, defaultQuery), { refId: '121314' });
        const ds = {
            metadataRequest(url) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (url === '/api/services') {
                        return Promise.resolve(['jaeger-query', 'service2', 'service3']);
                    }
                    return undefined;
                });
            },
        };
        setupFetchMock({ data: [testResponse] });
        render(React.createElement(SearchForm, { datasource: ds, query: query, onChange: handleOnChange }));
        const asyncServiceSelect = yield waitFor(() => screen.getByRole('combobox', { name: 'select-service-name' }));
        expect(asyncServiceSelect).toBeInTheDocument();
        yield userEvent.click(asyncServiceSelect);
        const jaegerService = yield screen.findByText('jaeger-query');
        expect(jaegerService).toBeInTheDocument();
    }));
    it('should be able to select operation name if query.service exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const promise = Promise.resolve();
        const handleOnChange = jest.fn(() => promise);
        const query2 = Object.assign(Object.assign({}, defaultQuery), { refId: '121314', service: 'jaeger-query' });
        setupFetchMock({ data: [testResponse] });
        render(React.createElement(SearchForm, { datasource: {}, query: query2, onChange: handleOnChange }));
        const asyncOperationSelect2 = yield waitFor(() => screen.getByRole('combobox', { name: 'select-operation-name' }));
        expect(asyncOperationSelect2).toBeInTheDocument();
    }));
});
describe('SearchForm', () => {
    let user;
    let query;
    let ds;
    beforeEach(() => {
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
        query = Object.assign(Object.assign({}, defaultQuery), { refId: '121314', service: 'jaeger-query' });
        ds = new JaegerDatasource(defaultSettings);
        setupFetchMock({ data: [testResponse] });
        jest.spyOn(ds, 'metadataRequest').mockImplementation(() => {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(['jaeger-query']);
                }, 3000);
            });
        });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should show loader if there is a delay fetching options', () => __awaiter(void 0, void 0, void 0, function* () {
        const handleOnChange = jest.fn();
        render(React.createElement(SearchForm, { datasource: ds, query: query, onChange: handleOnChange }));
        const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
        yield user.click(asyncServiceSelect);
        expect(screen.getByText('Loading options...')).toBeInTheDocument();
        jest.advanceTimersByTime(3000);
        yield waitFor(() => expect(screen.queryByText('Loading options...')).not.toBeInTheDocument());
    }));
    it('should filter the span dropdown when user types a search value', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SearchForm, { datasource: ds, query: query, onChange: () => { } }));
        const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
        expect(asyncServiceSelect).toBeInTheDocument();
        yield user.click(asyncServiceSelect);
        jest.advanceTimersByTime(3000);
        yield user.type(asyncServiceSelect, 'j');
        let option = yield screen.findByText('jaeger-query');
        expect(option).toBeDefined();
        yield user.type(asyncServiceSelect, 'c');
        option = yield screen.findByText('Hit enter to add');
        expect(option).toBeDefined();
    }));
    it('should add variable to select menu options', () => __awaiter(void 0, void 0, void 0, function* () {
        query = Object.assign(Object.assign({}, defaultQuery), { refId: '121314', service: '$service', operation: '$operation' });
        render(React.createElement(SearchForm, { datasource: ds, query: query, onChange: () => { } }));
        const asyncServiceSelect = screen.getByRole('combobox', { name: 'select-service-name' });
        expect(asyncServiceSelect).toBeInTheDocument();
        yield user.click(asyncServiceSelect);
        jest.advanceTimersByTime(3000);
        yield user.type(asyncServiceSelect, '$');
        const serviceOption = yield screen.findByText('$service');
        expect(serviceOption).toBeDefined();
        const asyncOperationSelect = screen.getByRole('combobox', { name: 'select-operation-name' });
        expect(asyncOperationSelect).toBeInTheDocument();
        yield user.click(asyncOperationSelect);
        jest.advanceTimersByTime(3000);
        yield user.type(asyncOperationSelect, '$');
        const operationOption = yield screen.findByText('$operation');
        expect(operationOption).toBeDefined();
    }));
});
function setupFetchMock(response, mock) {
    const defaultMock = () => mock !== null && mock !== void 0 ? mock : of(createFetchResponse(response));
    const fetchMock = jest.spyOn(backendSrv, 'fetch');
    fetchMock.mockImplementation(defaultMock);
    return fetchMock;
}
const defaultSettings = {
    id: 0,
    uid: '0',
    type: 'tracing',
    name: 'jaeger',
    url: 'http://grafana.com',
    access: 'proxy',
    meta: {
        id: 'jaeger',
        name: 'jaeger',
        type: PluginType.datasource,
        info: {},
        module: '',
        baseUrl: '',
    },
    jsonData: {
        nodeGraph: {
            enabled: true,
        },
    },
    readOnly: false,
};
const defaultQuery = {
    requestId: '1',
    interval: '0',
    intervalMs: 10,
    panelId: 0,
    scopedVars: {},
    range: {
        from: dateTime().subtract(1, 'h'),
        to: dateTime(),
        raw: { from: '1h', to: 'now' },
    },
    timezone: 'browser',
    app: 'explore',
    startTime: 0,
    targets: [
        {
            query: '12345',
            refId: '1',
        },
    ],
};
//# sourceMappingURL=SearchForm.test.js.map