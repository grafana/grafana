import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TraceqlSearchScope } from '../dataquery.gen';
import TempoLanguageProvider from '../language_provider';
import { GroupByField } from './GroupByField';
describe('GroupByField', () => {
    let user;
    const datasource = {
        search: {
            filters: [],
        },
    };
    const lp = new TempoLanguageProvider(datasource);
    datasource.languageProvider = lp;
    let query = {
        refId: 'A',
        queryType: 'traceqlSearch',
        query: '',
        filters: [],
        groupBy: [{ id: 'group-by-id', scope: TraceqlSearchScope.Span, tag: 'component' }],
    };
    const onChange = (q) => {
        query = q;
    };
    jest.spyOn(lp, 'getMetricsSummaryTags').mockReturnValue(['component', 'http.method', 'http.status_code']);
    beforeEach(() => {
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should update scope when new value is selected in scope input', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const { container } = render(React.createElement(GroupByField, { datasource: datasource, query: query, onChange: onChange, isTagsLoading: false }));
        const scopeSelect = container.querySelector(`input[aria-label="Select scope for filter 1"]`);
        expect(scopeSelect).not.toBeNull();
        expect(scopeSelect).toBeInTheDocument();
        if (scopeSelect) {
            yield user.click(scopeSelect);
            jest.advanceTimersByTime(1000);
            const resourceScope = yield screen.findByText('resource');
            yield user.click(resourceScope);
            const groupByFilter = (_a = query.groupBy) === null || _a === void 0 ? void 0 : _a.find((f) => f.id === 'group-by-id');
            expect(groupByFilter).not.toBeNull();
            expect(groupByFilter === null || groupByFilter === void 0 ? void 0 : groupByFilter.scope).toBe('resource');
            expect(groupByFilter === null || groupByFilter === void 0 ? void 0 : groupByFilter.tag).toBe('');
        }
    }));
    it('should update tag when new value is selected in tag input', () => __awaiter(void 0, void 0, void 0, function* () {
        var _b;
        const { container } = render(React.createElement(GroupByField, { datasource: datasource, query: query, onChange: onChange, isTagsLoading: false }));
        const tagSelect = container.querySelector(`input[aria-label="Select tag for filter 1"]`);
        expect(tagSelect).not.toBeNull();
        expect(tagSelect).toBeInTheDocument();
        if (tagSelect) {
            yield user.click(tagSelect);
            jest.advanceTimersByTime(1000);
            const tag = yield screen.findByText('http.method');
            yield user.click(tag);
            const groupByFilter = (_b = query.groupBy) === null || _b === void 0 ? void 0 : _b.find((f) => f.id === 'group-by-id');
            expect(groupByFilter).not.toBeNull();
            expect(groupByFilter === null || groupByFilter === void 0 ? void 0 : groupByFilter.tag).toBe('http.method');
        }
    }));
});
//# sourceMappingURL=GroupByField.test.js.map