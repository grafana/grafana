import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { initTemplateSrv } from 'test/helpers/initTemplateSrv';
import { setTemplateSrv } from '@grafana/runtime';
import { TraceqlSearchScope } from '../dataquery.gen';
import SearchField from './SearchField';
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
jest.mock('../language_provider', () => {
    return jest.fn().mockImplementation(() => {
        return { getOptionsV2 };
    });
});
describe('SearchField', () => {
    let templateSrv = initTemplateSrv('key', [{ name: 'templateVariable1' }, { name: 'templateVariable2' }]);
    let user;
    beforeEach(() => {
        setTemplateSrv(templateSrv);
        jest.useFakeTimers();
        // Need to use delay: null here to work with fakeTimers
        // see https://github.com/testing-library/user-event/issues/833
        user = userEvent.setup({ delay: null });
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('should not render tag if hideTag is true', () => {
        const updateFilter = jest.fn((val) => {
            return val;
        });
        const filter = { id: 'test1', valueType: 'string', tag: 'test-tag' };
        const { container } = renderSearchField(updateFilter, filter, [], true);
        expect(container.querySelector(`input[aria-label="select test1 tag"]`)).not.toBeInTheDocument();
        expect(container.querySelector(`input[aria-label="select test1 operator"]`)).toBeInTheDocument();
        expect(container.querySelector(`input[aria-label="select test1 value"]`)).toBeInTheDocument();
    });
    it('should update operator when new value is selected in operator input', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateFilter = jest.fn((val) => {
            return val;
        });
        const filter = { id: 'test1', operator: '=', valueType: 'string', tag: 'test-tag' };
        const { container } = renderSearchField(updateFilter, filter);
        const select = yield container.querySelector(`input[aria-label="select test1 operator"]`);
        expect(select).not.toBeNull();
        expect(select).toBeInTheDocument();
        if (select) {
            yield user.click(select);
            jest.advanceTimersByTime(1000);
            const largerThanOp = yield screen.findByText('!=');
            yield user.click(largerThanOp);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { operator: '!=' }));
        }
    }));
    it('should update value when new value is selected in value input', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateFilter = jest.fn((val) => {
            return val;
        });
        const filter = {
            id: 'test1',
            valueType: 'string',
            tag: 'test-tag',
        };
        const { container } = renderSearchField(updateFilter, filter);
        const select = yield container.querySelector(`input[aria-label="select test1 value"]`);
        expect(select).not.toBeNull();
        expect(select).toBeInTheDocument();
        if (select) {
            // Add first value
            yield user.click(select);
            jest.advanceTimersByTime(1000);
            const driverVal = yield screen.findByText('driver');
            yield user.click(driverVal);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { value: ['driver'] }));
            // Add a second value
            yield user.click(select);
            jest.advanceTimersByTime(1000);
            const customerVal = yield screen.findByText('customer');
            yield user.click(customerVal);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { value: ['driver', 'customer'] }));
            // Remove the first value
            const firstValRemove = yield screen.findAllByLabelText('Remove');
            yield user.click(firstValRemove[0]);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { value: ['customer'] }));
        }
    }));
    it('should update tag when new value is selected in tag input', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateFilter = jest.fn((val) => {
            return val;
        });
        const filter = {
            id: 'test1',
            valueType: 'string',
        };
        const { container } = renderSearchField(updateFilter, filter, ['tag1', 'tag22', 'tag33']);
        const select = container.querySelector(`input[aria-label="select test1 tag"]`);
        expect(select).not.toBeNull();
        expect(select).toBeInTheDocument();
        if (select) {
            // Select tag22 as the tag
            yield user.click(select);
            jest.advanceTimersByTime(1000);
            const tag22 = yield screen.findByText('tag22');
            yield user.click(tag22);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { tag: 'tag22' }));
            // Select tag1 as the tag
            yield user.click(select);
            jest.advanceTimersByTime(1000);
            const tag1 = yield screen.findByText('tag1');
            yield user.click(tag1);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { tag: 'tag1' }));
            // Remove the tag
            const tagRemove = yield screen.findByLabelText('select-clear-value');
            yield user.click(tagRemove);
            expect(updateFilter).toHaveBeenCalledWith(Object.assign(Object.assign({}, filter), { value: undefined }));
        }
    }));
    it('should not provide intrinsic as a selectable scope', () => __awaiter(void 0, void 0, void 0, function* () {
        const updateFilter = jest.fn((val) => {
            return val;
        });
        const filter = { id: 'test1', valueType: 'string', tag: 'test-tag' };
        const { container } = renderSearchField(updateFilter, filter, [], true);
        const scopeSelect = container.querySelector(`input[aria-label="select test1 scope"]`);
        expect(scopeSelect).not.toBeNull();
        expect(scopeSelect).toBeInTheDocument();
        if (scopeSelect) {
            yield user.click(scopeSelect);
            jest.advanceTimersByTime(1000);
            expect(yield screen.findByText('resource')).toBeInTheDocument();
            expect(yield screen.findByText('span')).toBeInTheDocument();
            expect(yield screen.findByText('unscoped')).toBeInTheDocument();
            expect(screen.queryByText('intrinsic')).not.toBeInTheDocument();
            expect(yield screen.findByText('$templateVariable1')).toBeInTheDocument();
            expect(yield screen.findByText('$templateVariable2')).toBeInTheDocument();
        }
    }));
});
const renderSearchField = (updateFilter, filter, tags, hideTag) => {
    const datasource = {
        search: {
            filters: [
                {
                    id: 'service-name',
                    tag: 'service.name',
                    operator: '=',
                    scope: TraceqlSearchScope.Resource,
                },
                { id: 'span-name', type: 'static', tag: 'name', operator: '=', scope: TraceqlSearchScope.Span },
            ],
        },
    };
    return render(React.createElement(SearchField, { datasource: datasource, updateFilter: updateFilter, filter: filter, setError: function (error) {
            throw error;
        }, tags: tags || [], hideTag: hideTag, query: '{}' }));
};
//# sourceMappingURL=SearchField.test.js.map