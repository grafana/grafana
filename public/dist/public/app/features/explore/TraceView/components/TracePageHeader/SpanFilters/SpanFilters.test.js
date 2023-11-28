import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { defaultFilters } from '../../../useSearch';
import { SpanFilters } from './SpanFilters';
const trace = {
    traceID: '1ed38015486087ca',
    spans: [
        {
            traceID: '1ed38015486087ca',
            spanID: '1ed38015486087ca',
            operationName: 'Span0',
            tags: [{ key: 'TagKey0', type: 'string', value: 'TagValue0' }],
            kind: 'server',
            statusCode: 2,
            statusMessage: 'message',
            instrumentationLibraryName: 'name',
            instrumentationLibraryVersion: 'version',
            traceState: 'state',
            process: {
                serviceName: 'Service0',
                tags: [{ key: 'ProcessKey0', type: 'string', value: 'ProcessValue0' }],
            },
            logs: [{ fields: [{ key: 'LogKey0', type: 'string', value: 'LogValue0' }] }],
        },
        {
            traceID: '1ed38015486087ca',
            spanID: '2ed38015486087ca',
            operationName: 'Span1',
            tags: [{ key: 'TagKey1', type: 'string', value: 'TagValue1' }],
            process: {
                serviceName: 'Service1',
                tags: [{ key: 'ProcessKey1', type: 'string', value: 'ProcessValue1' }],
            },
            logs: [{ fields: [{ key: 'LogKey1', type: 'string', value: 'LogValue1' }] }],
        },
    ],
    processes: {
        '1ed38015486087ca': {
            serviceName: 'Service0',
            tags: [],
        },
    },
};
describe('SpanFilters', () => {
    let user;
    const SpanFiltersWithProps = ({ showFilters = true, matches }) => {
        const [search, setSearch] = useState(defaultFilters);
        const [showSpanFilterMatchesOnly, setShowSpanFilterMatchesOnly] = useState(false);
        const props = {
            trace: trace,
            showSpanFilters: showFilters,
            setShowSpanFilters: jest.fn(),
            showSpanFilterMatchesOnly,
            setShowSpanFilterMatchesOnly,
            search,
            setSearch,
            spanFilterMatches: matches,
            setFocusedSpanIdForSearch: jest.fn(),
            datasourceType: 'tempo',
        };
        return React.createElement(SpanFilters, Object.assign({}, props));
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
    it('should render', () => {
        expect(() => render(React.createElement(SpanFiltersWithProps, null))).not.toThrow();
    });
    it('should render filters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, null));
        const serviceOperator = screen.getByLabelText('Select service name operator');
        const serviceValue = screen.getByLabelText('Select service name');
        const spanOperator = screen.getByLabelText('Select span name operator');
        const spanValue = screen.getByLabelText('Select span name');
        const fromOperator = screen.getByLabelText('Select min span operator');
        const fromValue = screen.getByLabelText('Select min span duration');
        const toOperator = screen.getByLabelText('Select max span operator');
        const toValue = screen.getByLabelText('Select max span duration');
        const tagKey = screen.getByLabelText('Select tag key');
        const tagOperator = screen.getByLabelText('Select tag operator');
        const tagValue = screen.getByLabelText('Select tag value');
        const addTag = screen.getByLabelText('Add tag');
        const removeTag = screen.getByLabelText('Remove tag');
        expect(serviceOperator).toBeInTheDocument();
        expect(getElemText(serviceOperator)).toBe('=');
        expect(serviceValue).toBeInTheDocument();
        expect(spanOperator).toBeInTheDocument();
        expect(getElemText(spanOperator)).toBe('=');
        expect(spanValue).toBeInTheDocument();
        expect(fromOperator).toBeInTheDocument();
        expect(getElemText(fromOperator)).toBe('>');
        expect(fromValue).toBeInTheDocument();
        expect(toOperator).toBeInTheDocument();
        expect(getElemText(toOperator)).toBe('<');
        expect(toValue).toBeInTheDocument();
        expect(tagKey).toBeInTheDocument();
        expect(tagOperator).toBeInTheDocument();
        expect(getElemText(tagOperator)).toBe('=');
        expect(tagValue).toBeInTheDocument();
        expect(addTag).toBeInTheDocument();
        expect(removeTag).toBeInTheDocument();
        yield user.click(serviceValue);
        jest.advanceTimersByTime(1000);
        yield waitFor(() => {
            expect(screen.getByText('Service0')).toBeInTheDocument();
            expect(screen.getByText('Service1')).toBeInTheDocument();
        });
        yield user.click(spanValue);
        jest.advanceTimersByTime(1000);
        yield waitFor(() => {
            expect(screen.getByText('Span0')).toBeInTheDocument();
            expect(screen.getByText('Span1')).toBeInTheDocument();
        });
        yield user.click(tagKey);
        jest.advanceTimersByTime(1000);
        yield waitFor(() => {
            expect(screen.getByText('TagKey0')).toBeInTheDocument();
            expect(screen.getByText('TagKey1')).toBeInTheDocument();
            expect(screen.getByText('kind')).toBeInTheDocument();
            expect(screen.getByText('ProcessKey0')).toBeInTheDocument();
            expect(screen.getByText('ProcessKey1')).toBeInTheDocument();
            expect(screen.getByText('LogKey0')).toBeInTheDocument();
            expect(screen.getByText('LogKey1')).toBeInTheDocument();
        });
    }));
    it('should update filters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, null));
        const serviceValue = screen.getByLabelText('Select service name');
        const spanValue = screen.getByLabelText('Select span name');
        const tagKey = screen.getByLabelText('Select tag key');
        const tagValue = screen.getByLabelText('Select tag value');
        expect(getElemText(serviceValue)).toBe('All service names');
        yield selectAndCheckValue(user, serviceValue, 'Service0');
        expect(getElemText(spanValue)).toBe('All span names');
        yield selectAndCheckValue(user, spanValue, 'Span0');
        yield user.click(tagValue);
        jest.advanceTimersByTime(1000);
        yield waitFor(() => expect(screen.getByText('No options found')).toBeInTheDocument());
        expect(getElemText(tagKey)).toBe('Select tag');
        yield selectAndCheckValue(user, tagKey, 'TagKey0');
        expect(getElemText(tagValue)).toBe('Select value');
        yield selectAndCheckValue(user, tagValue, 'TagValue0');
    }));
    it('should order tag filters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, null));
        const tagKey = screen.getByLabelText('Select tag key');
        yield user.click(tagKey);
        jest.advanceTimersByTime(1000);
        yield waitFor(() => {
            var _a, _b;
            const container = (_b = (_a = screen.getByText('TagKey0').parentElement) === null || _a === void 0 ? void 0 : _a.parentElement) === null || _b === void 0 ? void 0 : _b.parentElement;
            expect(container === null || container === void 0 ? void 0 : container.childNodes[0].textContent).toBe('ProcessKey0');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[1].textContent).toBe('ProcessKey1');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[2].textContent).toBe('TagKey0');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[3].textContent).toBe('TagKey1');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[4].textContent).toBe('id');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[5].textContent).toBe('kind');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[6].textContent).toBe('library.name');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[7].textContent).toBe('library.version');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[8].textContent).toBe('status');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[9].textContent).toBe('status.message');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[10].textContent).toBe('trace.state');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[11].textContent).toBe('LogKey0');
            expect(container === null || container === void 0 ? void 0 : container.childNodes[12].textContent).toBe('LogKey1');
        });
    }));
    it('should allow adding/removing tags', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, null));
        expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
        yield user.click(screen.getByLabelText('Add tag'));
        jest.advanceTimersByTime(1000);
        expect(screen.getAllByLabelText('Select tag key').length).toBe(2);
        yield user.click(screen.getAllByLabelText('Remove tag')[0]);
        jest.advanceTimersByTime(1000);
        expect(screen.getAllByLabelText('Select tag key').length).toBe(1);
    }));
    it('should allow resetting filters', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, { matches: new Set('1ed38015486087ca') }));
        const clearFiltersButton = screen.getByRole('button', { name: 'Clear filters button' });
        expect(clearFiltersButton).toBeInTheDocument();
        expect(clearFiltersButton['disabled']).toBe(true);
        const serviceValue = screen.getByLabelText('Select service name');
        const spanValue = screen.getByLabelText('Select span name');
        const tagKey = screen.getByLabelText('Select tag key');
        const tagValue = screen.getByLabelText('Select tag value');
        yield selectAndCheckValue(user, serviceValue, 'Service0');
        yield selectAndCheckValue(user, spanValue, 'Span0');
        yield selectAndCheckValue(user, tagKey, 'TagKey0');
        yield selectAndCheckValue(user, tagValue, 'TagValue0');
        const matchesSwitch = screen.getByRole('checkbox', { name: 'Show matches only switch' });
        expect(matchesSwitch).not.toBeChecked();
        yield user.click(matchesSwitch);
        expect(matchesSwitch).toBeChecked();
        expect(clearFiltersButton['disabled']).toBe(false);
        yield user.click(clearFiltersButton);
        expect(screen.queryByText('Service0')).not.toBeInTheDocument();
        expect(screen.queryByText('Span0')).not.toBeInTheDocument();
        expect(screen.queryByText('TagKey0')).not.toBeInTheDocument();
        expect(screen.queryByText('TagValue0')).not.toBeInTheDocument();
        expect(matchesSwitch).not.toBeChecked();
    }));
    it('renders buttons when span filters is collapsed', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(SpanFiltersWithProps, { showFilters: false }));
        expect(screen.queryByRole('button', { name: 'Next result button' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Prev result button' })).toBeInTheDocument();
    }));
});
const selectAndCheckValue = (user, elem, text) => __awaiter(void 0, void 0, void 0, function* () {
    yield user.click(elem);
    jest.advanceTimersByTime(1000);
    yield waitFor(() => expect(screen.getByText(text)).toBeInTheDocument());
    yield user.click(screen.getByText(text));
    jest.advanceTimersByTime(1000);
    expect(screen.getByText(text)).toBeInTheDocument();
});
const getElemText = (elem) => {
    var _a, _b;
    return (_b = (_a = elem.parentElement) === null || _a === void 0 ? void 0 : _a.previousSibling) === null || _b === void 0 ? void 0 : _b.textContent;
};
//# sourceMappingURL=SpanFilters.test.js.map