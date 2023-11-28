import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';
import { config } from '@grafana/runtime';
import { TraceqlSearchScope } from '../dataquery.gen';
import TempoLanguageProvider from '../language_provider';
import TraceQLSearch from './TraceQLSearch';
const getOptionsV2 = jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve([
                {
                    value: 'customer',
                    label: 'customer',
                    type: 'string',
                },
                {
                    value: 'driver',
                    label: 'driver',
                    type: 'string',
                },
            ]);
        }, 1000);
    });
});
const getTags = jest.fn().mockImplementation(() => {
    return ['foo', 'bar'];
});
jest.mock('../language_provider', () => {
    return jest.fn().mockImplementation(() => {
        return { getOptionsV2, getTags };
    });
});
describe('TraceQLSearch', () => {
    initTemplateSrv('key', []);
    let user;
    const datasource = {
        search: {
            filters: [
                {
                    id: 'service-name',
                    tag: 'service.name',
                    operator: '=',
                    scope: TraceqlSearchScope.Resource,
                },
            ],
        },
    };
    datasource.languageProvider = new TempoLanguageProvider(datasource);
    let query = {
        refId: 'A',
        queryType: 'traceqlSearch',
        key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
        query: '',
        filters: [{ id: 'min-duration', operator: '>', valueType: 'duration', tag: 'duration' }],
    };
    const onChange = (q) => {
        query = q;
    };
    beforeEach(() => {
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should update operator when new value is selected in operator input', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(TraceQLSearch, { datasource: datasource, query: query, onChange: onChange }));
        const minDurationOperator = container.querySelector(`input[aria-label="select min-duration operator"]`);
        expect(minDurationOperator).not.toBeNull();
        expect(minDurationOperator).toBeInTheDocument();
        if (minDurationOperator) {
            yield user.click(minDurationOperator);
            jest.advanceTimersByTime(1000);
            const regexOp = yield screen.findByText('>=');
            yield user.click(regexOp);
            const minDurationFilter = query.filters.find((f) => f.id === 'min-duration');
            expect(minDurationFilter).not.toBeNull();
            expect(minDurationFilter === null || minDurationFilter === void 0 ? void 0 : minDurationFilter.operator).toBe('>=');
        }
    }));
    it('should add new filter when new value is selected in the service name section', () => __awaiter(void 0, void 0, void 0, function* () {
        const { container } = render(React.createElement(TraceQLSearch, { datasource: datasource, query: query, onChange: onChange }));
        const serviceNameValue = container.querySelector(`input[aria-label="select service-name value"]`);
        expect(serviceNameValue).not.toBeNull();
        expect(serviceNameValue).toBeInTheDocument();
        expect(query.filters.find((f) => f.id === 'service-name')).not.toBeDefined();
        if (serviceNameValue) {
            yield user.click(serviceNameValue);
            jest.advanceTimersByTime(1000);
            const customerValue = yield screen.findByText('customer');
            yield user.click(customerValue);
            const nameFilter = query.filters.find((f) => f.id === 'service-name');
            expect(nameFilter).not.toBeNull();
            expect(nameFilter === null || nameFilter === void 0 ? void 0 : nameFilter.operator).toBe('=');
            expect(nameFilter === null || nameFilter === void 0 ? void 0 : nameFilter.value).toStrictEqual(['customer']);
            expect(nameFilter === null || nameFilter === void 0 ? void 0 : nameFilter.tag).toBe('service.name');
            expect(nameFilter === null || nameFilter === void 0 ? void 0 : nameFilter.scope).toBe(TraceqlSearchScope.Resource);
        }
    }));
    it('should not render static filter when no tag is configured', () => __awaiter(void 0, void 0, void 0, function* () {
        const datasource = {
            search: {
                filters: [
                    {
                        id: 'service-name',
                        operator: '=',
                        scope: TraceqlSearchScope.Resource,
                    },
                ],
            },
        };
        datasource.languageProvider = new TempoLanguageProvider(datasource);
        yield act(() => __awaiter(void 0, void 0, void 0, function* () {
            const { container } = render(React.createElement(TraceQLSearch, { datasource: datasource, query: query, onChange: onChange }));
            const serviceNameValue = container.querySelector(`input[aria-label="select service-name value"]`);
            expect(serviceNameValue).toBeNull();
            expect(serviceNameValue).not.toBeInTheDocument();
        }));
    }));
    it('should not render group by when feature toggle is not enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        yield waitFor(() => {
            render(React.createElement(TraceQLSearch, { datasource: datasource, query: query, onChange: onChange }));
            const groupBy = screen.queryByText('Aggregate by');
            expect(groupBy).toBeNull();
            expect(groupBy).not.toBeInTheDocument();
        });
    }));
    it('should render group by when feature toggle enabled', () => __awaiter(void 0, void 0, void 0, function* () {
        config.featureToggles.metricsSummary = true;
        yield waitFor(() => {
            render(React.createElement(TraceQLSearch, { datasource: datasource, query: query, onChange: onChange }));
            const groupBy = screen.queryByText('Aggregate by');
            expect(groupBy).not.toBeNull();
            expect(groupBy).toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=TraceQLSearch.test.js.map