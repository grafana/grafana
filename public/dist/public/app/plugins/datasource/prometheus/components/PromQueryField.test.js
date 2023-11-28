import { __awaiter } from "tslib";
import { getByTestId, render, screen, waitFor } from '@testing-library/react';
// @ts-ignore
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LoadingState, CoreApp } from '@grafana/data';
import PromQueryField from './PromQueryField';
// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
    const fakeQueryField = (props) => {
        return React.createElement("input", { onBlur: (e) => props.onBlur(e.currentTarget.value), "data-testid": 'dummy-code-input', type: 'text' });
    };
    return {
        MonacoQueryFieldLazy: fakeQueryField,
    };
});
const defaultProps = {
    datasource: {
        languageProvider: {
            start: () => Promise.resolve([]),
            syntax: () => { },
            getLabelKeys: () => [],
            metrics: [],
        },
        getInitHints: () => [],
    },
    query: {
        expr: '',
        refId: '',
    },
    onRunQuery: () => { },
    onChange: () => { },
    history: [],
};
describe('PromQueryField', () => {
    beforeAll(() => {
        // @ts-ignore
        window.getSelection = () => { };
    });
    it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', () => __awaiter(void 0, void 0, void 0, function* () {
        const queryField = render(React.createElement(PromQueryField, Object.assign({}, defaultProps)));
        // wait for component to render
        yield screen.findByRole('button');
        expect(queryField.getAllByRole('button')).toHaveLength(1);
    }));
    it('renders a disabled metrics chooser if lookups are disabled in datasource settings', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = defaultProps;
        props.datasource.lookupsDisabled = true;
        const queryField = render(React.createElement(PromQueryField, Object.assign({}, props)));
        // wait for component to render
        yield screen.findByRole('button');
        const bcButton = queryField.getByRole('button');
        expect(bcButton).toBeDisabled();
    }));
    it('renders an initial hint if no data and initial hint provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = defaultProps;
        props.datasource.lookupsDisabled = true;
        props.datasource.getInitHints = () => [{ label: 'Initial hint', type: 'INFO' }];
        render(React.createElement(PromQueryField, Object.assign({}, props)));
        // wait for component to render
        yield screen.findByRole('button');
        expect(screen.getByText('Initial hint')).toBeInTheDocument();
    }));
    it('renders query hint if data, query hint and initial hint provided', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = defaultProps;
        props.datasource.lookupsDisabled = true;
        props.datasource.getInitHints = () => [{ label: 'Initial hint', type: 'INFO' }];
        props.datasource.getQueryHints = () => [{ label: 'Query hint', type: 'INFO' }];
        render(React.createElement(PromQueryField, Object.assign({}, props, { data: {
                series: [{ name: 'test name' }],
                state: LoadingState.Done,
            } })));
        // wait for component to render
        yield screen.findByRole('button');
        expect(screen.getByText('Query hint')).toBeInTheDocument();
        expect(screen.queryByText('Initial hint')).not.toBeInTheDocument();
    }));
    it('refreshes metrics when the data source changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const defaultProps = {
            query: { expr: '', refId: '' },
            onRunQuery: () => { },
            onChange: () => { },
            history: [],
        };
        const metrics = ['foo', 'bar'];
        const queryField = render(React.createElement(PromQueryField, Object.assign({ datasource: {
                languageProvider: makeLanguageProvider({ metrics: [metrics] }),
                getInitHints: () => [],
            } }, defaultProps)));
        // wait for component to render
        yield screen.findByRole('button');
        const changedMetrics = ['baz', 'moo'];
        queryField.rerender(React.createElement(PromQueryField
        // @ts-ignore
        , Object.assign({ 
            // @ts-ignore
            datasource: {
                languageProvider: makeLanguageProvider({ metrics: [changedMetrics] }),
            } }, defaultProps)));
        // If we check the label browser right away it should be in loading state
        let labelBrowser = screen.getByRole('button');
        expect(labelBrowser).toHaveTextContent('Loading');
        // wait for component to rerender
        labelBrowser = yield screen.findByRole('button');
        yield waitFor(() => {
            expect(labelBrowser).toHaveTextContent('Metrics browser');
        });
    }));
    it('should not run query onBlur', () => __awaiter(void 0, void 0, void 0, function* () {
        const onRunQuery = jest.fn();
        const { container } = render(React.createElement(PromQueryField, Object.assign({}, defaultProps, { app: CoreApp.Explore, onRunQuery: onRunQuery })));
        // wait for component to rerender
        yield screen.findByRole('button');
        const input = getByTestId(container, 'dummy-code-input');
        expect(input).toBeInTheDocument();
        yield userEvent.type(input, 'metric');
        // blur element
        yield userEvent.click(document.body);
        expect(onRunQuery).not.toHaveBeenCalled();
    }));
});
function makeLanguageProvider(options) {
    const metricsStack = [...options.metrics];
    return {
        histogramMetrics: [],
        metrics: [],
        metricsMetadata: {},
        lookupsDisabled: false,
        getLabelKeys: () => [],
        start() {
            this.metrics = metricsStack.shift();
            return Promise.resolve([]);
        },
    };
}
//# sourceMappingURL=PromQueryField.test.js.map