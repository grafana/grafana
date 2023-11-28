import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { createLokiDatasource } from '../../mocks';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';
import { LokiQueryCodeEditor } from './LokiQueryCodeEditor';
const defaultQuery = {
    expr: '{job="bar}',
    refId: 'A',
};
const createDefaultProps = () => {
    const datasource = createLokiDatasource();
    const props = {
        datasource,
        onRunQuery: () => { },
        onChange: () => { },
        showExplain: false,
        setQueryStats: () => { },
    };
    return props;
};
describe('LokiQueryCodeEditor', () => {
    it('shows explain section when showExplain is true', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createDefaultProps();
        props.showExplain = true;
        props.datasource.metadataRequest = jest.fn().mockResolvedValue([]);
        render(React.createElement(LokiQueryCodeEditor, Object.assign({}, props, { query: defaultQuery })));
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
        expect(screen.getByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
    }));
    it('does not show explain section when showExplain is false', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = createDefaultProps();
        props.datasource.metadataRequest = jest.fn().mockResolvedValue([]);
        render(React.createElement(LokiQueryCodeEditor, Object.assign({}, props, { query: defaultQuery })));
        expect(yield screen.findByText('Loading...')).toBeInTheDocument();
        expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    }));
});
//# sourceMappingURL=LokiQueryCodeEditor.test.js.map