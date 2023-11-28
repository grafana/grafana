import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { cloneDeep, defaultsDeep } from 'lodash';
import React from 'react';
import { CoreApp, PluginType } from '@grafana/data';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { QueryEditorMode } from '../shared/types';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
import { PromQueryEditorSelector } from './PromQueryEditorSelector';
// We need to mock this because it seems jest has problem importing monaco in tests
jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
    return {
        MonacoQueryFieldWrapper: () => {
            return 'MonacoQueryFieldWrapper';
        },
    };
});
jest.mock('app/core/store', () => {
    return {
        get() {
            return undefined;
        },
        set() { },
        getObject(key, defaultValue) {
            return defaultValue;
        },
    };
});
jest.mock('@grafana/runtime', () => {
    return Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { reportInteraction: jest.fn() });
});
const defaultQuery = {
    refId: 'A',
    expr: 'metric{label1="foo", label2="bar"}',
};
const defaultMeta = {
    id: '',
    name: '',
    type: PluginType.datasource,
    info: {
        author: {
            name: 'tester',
        },
        description: 'testing',
        links: [],
        logos: {
            large: '',
            small: '',
        },
        screenshots: [],
        updated: '',
        version: '',
    },
    module: '',
    baseUrl: '',
};
const getDefaultDatasource = (jsonDataOverrides = {}) => new PrometheusDatasource({
    id: 1,
    uid: '',
    type: 'prometheus',
    name: 'prom-test',
    access: 'proxy',
    url: '',
    jsonData: jsonDataOverrides,
    meta: defaultMeta,
    readOnly: false,
}, undefined, undefined, new EmptyLanguageProviderMock());
const defaultProps = {
    datasource: getDefaultDatasource(),
    query: defaultQuery,
    onRunQuery: () => { },
    onChange: () => { },
};
describe('PromQueryEditorSelector', () => {
    it('shows code editor if expr and nothing else', () => __awaiter(void 0, void 0, void 0, function* () {
        // We opt for showing code editor for queries created before this feature was added
        render(React.createElement(PromQueryEditorSelector, Object.assign({}, defaultProps)));
        yield expectCodeEditor();
    }));
    it('shows code editor if no expr and nothing else since defaultEditor is code', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithDatasourceDefaultEditorMode(QueryEditorMode.Code);
        yield expectCodeEditor();
    }));
    it('shows builder if no expr and nothing else since defaultEditor is builder', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithDatasourceDefaultEditorMode(QueryEditorMode.Builder);
        yield expectBuilder();
    }));
    it('shows code editor when code mode is set', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Code);
        yield expectCodeEditor();
    }));
    it('shows builder when builder mode is set', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Builder);
        yield expectBuilder();
    }));
    it('shows Run Queries button in Dashboards', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Dashboard });
        yield expectRunQueriesButton();
    }));
    it('hides Run Queries button in Explore', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Explore });
        yield expectCodeEditor();
        expectNoRunQueriesButton();
    }));
    it('hides Run Queries button in Correlations Page', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({}, { app: CoreApp.Correlations });
        yield expectCodeEditor();
        expectNoRunQueriesButton();
    }));
    it('changes to builder mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = renderWithMode(QueryEditorMode.Code);
        yield switchToMode(QueryEditorMode.Builder);
        expect(onChange).toBeCalledWith({
            refId: 'A',
            expr: defaultQuery.expr,
            range: true,
            editorMode: QueryEditorMode.Builder,
        });
    }));
    it('Should show raw query', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithProps({
            editorMode: QueryEditorMode.Builder,
            expr: 'my_metric',
        });
        expect(screen.getByLabelText('selector').textContent).toBe('my_metric');
    }));
    it('Can enable explain', () => __awaiter(void 0, void 0, void 0, function* () {
        renderWithMode(QueryEditorMode.Builder);
        expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
        yield userEvent.click(screen.getByLabelText('Explain'));
        expect(yield screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('changes to code mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { onChange } = renderWithMode(QueryEditorMode.Builder);
        yield switchToMode(QueryEditorMode.Code);
        expect(onChange).toBeCalledWith({
            refId: 'A',
            expr: defaultQuery.expr,
            range: true,
            editorMode: QueryEditorMode.Code,
        });
    }));
    it('parses query when changing to builder mode', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = renderWithProps({
            refId: 'A',
            expr: 'rate(test_metric{instance="host.docker.internal:3000"}[$__interval])',
            editorMode: QueryEditorMode.Code,
        });
        yield switchToMode(QueryEditorMode.Builder);
        rerender(React.createElement(PromQueryEditorSelector, Object.assign({}, defaultProps, { query: {
                refId: 'A',
                expr: 'rate(test_metric{instance="host.docker.internal:3000"}[$__interval])',
                editorMode: QueryEditorMode.Builder,
            } })));
        yield screen.findByText('test_metric');
        expect(screen.getByText('host.docker.internal:3000')).toBeInTheDocument();
        expect(screen.getByText('Rate')).toBeInTheDocument();
        expect(screen.getByText('$__interval')).toBeInTheDocument();
    }));
});
function renderWithMode(mode) {
    return renderWithProps({ editorMode: mode });
}
function renderWithDatasourceDefaultEditorMode(mode) {
    const props = Object.assign(Object.assign({}, defaultProps), { datasource: getDefaultDatasource({
            defaultEditor: mode,
        }), query: {
            refId: 'B',
            expr: '',
        }, onRunQuery: () => { }, onChange: () => { } });
    render(React.createElement(PromQueryEditorSelector, Object.assign({}, props)));
}
function renderWithProps(overrides, componentProps = {}) {
    const query = defaultsDeep(overrides !== null && overrides !== void 0 ? overrides : {}, cloneDeep(defaultQuery));
    const onChange = jest.fn();
    const allProps = Object.assign(Object.assign({}, defaultProps), componentProps);
    const stuff = render(React.createElement(PromQueryEditorSelector, Object.assign({}, allProps, { query: query, onChange: onChange })));
    return Object.assign({ onChange }, stuff);
}
function expectCodeEditor() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByText('MonacoQueryFieldWrapper')).toBeInTheDocument();
    });
}
function expectBuilder() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByText('Metric')).toBeInTheDocument();
    });
}
function expectRunQueriesButton() {
    return __awaiter(this, void 0, void 0, function* () {
        expect(yield screen.findByRole('button', { name: /run queries/i })).toBeInTheDocument();
    });
}
function expectNoRunQueriesButton() {
    expect(screen.queryByRole('button', { name: /run queries/i })).not.toBeInTheDocument();
}
function switchToMode(mode) {
    return __awaiter(this, void 0, void 0, function* () {
        const label = {
            [QueryEditorMode.Code]: /Code/,
            [QueryEditorMode.Builder]: /Builder/,
        }[mode];
        const switchEl = screen.getByLabelText(label);
        yield userEvent.click(switchEl);
    });
}
//# sourceMappingURL=PromQueryEditorSelector.test.js.map