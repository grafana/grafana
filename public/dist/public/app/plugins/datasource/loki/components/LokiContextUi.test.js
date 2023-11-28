import { __awaiter } from "tslib";
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { SHOULD_INCLUDE_PIPELINE_OPERATIONS } from '../LogContextProvider';
import { IS_LOKI_LOG_CONTEXT_UI_OPEN, LokiContextUi } from './LokiContextUi';
// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: () => null })));
jest.mock('app/core/store', () => {
    return {
        set() { },
        getBool(key, defaultValue) {
            const item = window.localStorage.getItem(key);
            if (item === null) {
                return defaultValue;
            }
            else {
                return item === 'true';
            }
        },
        delete() { },
    };
});
const setupProps = () => {
    const defaults = {
        logContextProvider: Object.assign({}, mockLogContextProvider),
        updateFilter: jest.fn(),
        row: {
            entry: 'WARN test 1.23 on [xxx]',
            labels: {
                label1: 'value1',
                label3: 'value3',
            },
        },
        onClose: jest.fn(),
        origQuery: {
            expr: '{label1="value1"} | logfmt',
            refId: 'A',
        },
        runContextQuery: jest.fn(),
    };
    return defaults;
};
const mockLogContextProvider = {
    getInitContextFilters: jest.fn().mockImplementation(() => Promise.resolve([
        { value: 'value1', enabled: true, fromParser: false, label: 'label1' },
        { value: 'value3', enabled: false, fromParser: true, label: 'label3' },
    ])),
    processContextFiltersToExpr: jest.fn().mockImplementation((contextFilters, query) => `{${contextFilters
        .filter((filter) => filter.enabled)
        .map((filter) => `${filter.label}="${filter.value}"`)
        .join('` ')}}`),
    processPipelineStagesToExpr: jest
        .fn()
        .mockImplementation((currentExpr, query) => `${currentExpr} | newOperation`),
    getLogRowContext: jest.fn(),
    queryContainsValidPipelineStages: jest.fn().mockReturnValue(true),
    prepareExpression: jest.fn().mockImplementation((contextFilters, query) => `{${contextFilters
        .filter((filter) => filter.enabled)
        .map((filter) => `${filter.label}="${filter.value}"`)
        .join('` ')}}`),
};
describe('LokiContextUi', () => {
    const savedGlobal = global;
    beforeAll(() => {
        // TODO: `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
        if (!global.structuredClone) {
            global.structuredClone = function structuredClone(objectToClone) {
                const stringified = JSON.stringify(objectToClone);
                const parsed = JSON.parse(stringified);
                return parsed;
            };
        }
    });
    afterAll(() => {
        global = savedGlobal;
    });
    beforeEach(() => {
        window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
        window.localStorage.setItem(IS_LOKI_LOG_CONTEXT_UI_OPEN, 'true');
    });
    afterEach(() => {
        window.localStorage.clear();
    });
    it('renders and shows executed query text', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        yield waitFor(() => {
            // We should see the query text (it is split into multiple spans)
            expect(screen.getByText('{')).toBeInTheDocument();
            expect(screen.getByText('label1')).toBeInTheDocument();
            expect(screen.getByText('=')).toBeInTheDocument();
            expect(screen.getByText('"value1"')).toBeInTheDocument();
            expect(screen.getByText('}')).toBeInTheDocument();
        });
    }));
    it('initialize context filters', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        yield waitFor(() => {
            expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
        });
    }));
    it('finds label1 as a real label', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        yield waitFor(() => {
            expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
        });
        const select = yield screen.findAllByRole('combobox');
        yield selectOptionInTest(select[0], 'label1="value1"');
    }));
    it('finds label3 as a parsed label', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        yield waitFor(() => {
            expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
        });
        const select = yield screen.findAllByRole('combobox');
        yield selectOptionInTest(select[1], 'label3="value3"');
    }));
    it('calls updateFilter when selecting a label', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.useFakeTimers();
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        yield waitFor(() => {
            expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
            expect(screen.getAllByRole('combobox')).toHaveLength(2);
        });
        yield selectOptionInTest(screen.getAllByRole('combobox')[1], 'label3="value3"');
        act(() => {
            jest.runAllTimers();
        });
        expect(props.updateFilter).toHaveBeenCalled();
        jest.useRealTimers();
    }));
    it('unmounts and calls onClose', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const comp = render(React.createElement(LokiContextUi, Object.assign({}, props)));
        comp.unmount();
        yield waitFor(() => {
            expect(props.onClose).toHaveBeenCalled();
        });
    }));
    it('displays executed query even if context ui closed', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        render(React.createElement(LokiContextUi, Object.assign({}, props)));
        // We start with the context ui open and click on it to close
        yield userEvent.click(screen.getAllByRole('button')[0]);
        yield waitFor(() => {
            // We should see the query text (it is split into multiple spans)
            expect(screen.getByText('{')).toBeInTheDocument();
            expect(screen.getByText('label1')).toBeInTheDocument();
            expect(screen.getByText('=')).toBeInTheDocument();
            expect(screen.getByText('"value1"')).toBeInTheDocument();
            expect(screen.getByText('}')).toBeInTheDocument();
        });
    }));
    it('does not show parsed labels section if origQuery has 0 parsers', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"}',
                refId: 'A',
            } });
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.queryByText('Refine the search')).not.toBeInTheDocument();
        });
    }));
    it('shows parsed labels section if origQuery has 1 parser', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.getByText('Refine the search')).toBeInTheDocument();
        });
    }));
    it('renders pipeline operations switch as enabled when saved in localstorage', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.getByRole('checkbox').checked).toBe(true);
        });
    }));
    it('renders pipeline operations switch as disabled when saved in localstorage', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'false');
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.getByRole('checkbox').checked).toBe(false);
        });
    }));
    it('renders pipeline operations switch if query contains valid pipeline stages', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        props.logContextProvider.queryContainsValidPipelineStages.mockReturnValue(true);
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.getByRole('checkbox')).toBeInTheDocument();
        });
    }));
    it('does not render pipeline operations switch if query does not contain valid pipeline stages', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        props.logContextProvider.queryContainsValidPipelineStages.mockReturnValue(false);
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.queryByRole('checkbox')).toBeNull();
        });
    }));
    it('does not show parsed labels section if origQuery has 2 parsers', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt | json',
                refId: 'A',
            } });
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        yield waitFor(() => {
            expect(screen.queryByText('Refine the search')).not.toBeInTheDocument();
        });
    }));
    it('should revert to original query when revert button clicked', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setupProps();
        const newProps = Object.assign(Object.assign({}, props), { origQuery: {
                expr: '{label1="value1"} | logfmt',
                refId: 'A',
            } });
        render(React.createElement(LokiContextUi, Object.assign({}, newProps)));
        // In initial query, label3 is not selected
        yield waitFor(() => {
            expect(screen.queryByText('label3="value3"')).not.toBeInTheDocument();
        });
        // We select parsed label and label3="value3" should appear
        const parsedLabelsInput = screen.getAllByRole('combobox')[1];
        yield userEvent.click(parsedLabelsInput);
        yield userEvent.type(parsedLabelsInput, '{enter}');
        expect(screen.getByText('label3="value3"')).toBeInTheDocument();
        // We click on revert button and label3="value3" should disappear
        const revertButton = screen.getByTestId('revert-button');
        yield userEvent.click(revertButton);
        yield waitFor(() => {
            expect(screen.queryByText('label3="value3"')).not.toBeInTheDocument();
        });
    }));
});
//# sourceMappingURL=LokiContextUi.test.js.map