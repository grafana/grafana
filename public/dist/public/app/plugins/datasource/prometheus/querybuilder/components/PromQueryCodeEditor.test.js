import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { PrometheusDatasource } from '../../datasource';
import { EmptyLanguageProviderMock } from '../../language_provider.mock';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './PromQueryBuilderExplained';
import { PromQueryCodeEditor } from './PromQueryCodeEditor';
jest.mock('../../components/monaco-query-field/MonacoQueryFieldWrapper', () => {
    const fakeQueryField = () => React.createElement("div", null, "prometheus query field");
    return { MonacoQueryFieldWrapper: fakeQueryField };
});
function createDatasource() {
    const languageProvider = new EmptyLanguageProviderMock();
    const datasource = new PrometheusDatasource({
        url: '',
        jsonData: {},
        meta: {},
    }, undefined, undefined, languageProvider);
    return { datasource, languageProvider };
}
function createProps(datasource) {
    return {
        datasource,
        onRunQuery: () => { },
        onChange: () => { },
        showExplain: false,
    };
}
describe('PromQueryCodeEditor', () => {
    it('shows explain section when showExplain is true', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        const props = createProps(datasource);
        props.showExplain = true;
        render(React.createElement(PromQueryCodeEditor, Object.assign({}, props, { query: { expr: '', refId: 'refid', interval: '1s' } })));
        // wait for component to render
        yield screen.findByRole('button');
        expect(screen.getByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('does not show explain section when showExplain is false', () => __awaiter(void 0, void 0, void 0, function* () {
        const { datasource } = createDatasource();
        const props = createProps(datasource);
        render(React.createElement(PromQueryCodeEditor, Object.assign({}, props, { query: { expr: '', refId: 'refid', interval: '1s' } })));
        // wait for component to render
        yield screen.findByRole('button');
        expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=PromQueryCodeEditor.test.js.map