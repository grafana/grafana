import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { createLokiDatasource } from '../mocks';
import { LokiVariableQueryType } from '../types';
import { LokiVariableQueryEditor } from './VariableQueryEditor';
const refId = 'LokiVariableQueryEditor-VariableQuery';
describe('LokiVariableQueryEditor', () => {
    let props;
    beforeEach(() => {
        props = {
            datasource: createLokiDatasource({}),
            query: {
                refId: 'test',
                type: LokiVariableQueryType.LabelNames,
            },
            onRunQuery: () => { },
            onChange: () => { },
        };
        jest.spyOn(props.datasource, 'labelNamesQuery').mockResolvedValue([
            {
                text: 'moon',
            },
            {
                text: 'luna',
            },
        ]);
    });
    test('Allows to create a Label names variable', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        expect(onChange).not.toHaveBeenCalled();
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label names');
        expect(onChange).toHaveBeenCalledWith({
            type: LokiVariableQueryType.LabelNames,
            label: '',
            stream: '',
            refId,
        });
    }));
    test('Allows to create a Label values variable', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        expect(onChange).not.toHaveBeenCalled();
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        yield selectOptionInTest(screen.getByLabelText('Label'), 'luna');
        yield userEvent.type(screen.getByLabelText('Stream selector'), 'stream');
        yield waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());
        yield userEvent.click(document.body);
        expect(onChange).toHaveBeenCalledWith({
            type: LokiVariableQueryType.LabelValues,
            label: 'luna',
            stream: 'stream',
            refId,
        });
    }));
    test('Allows to create a Label values variable with custom label', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: onChange })));
        expect(onChange).not.toHaveBeenCalled();
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        yield userEvent.type(screen.getByLabelText('Label'), 'sol{enter}');
        yield userEvent.type(screen.getByLabelText('Stream selector'), 'stream');
        yield waitFor(() => expect(screen.getByDisplayValue('stream')).toBeInTheDocument());
        yield userEvent.click(document.body);
        expect(onChange).toHaveBeenCalledWith({
            type: LokiVariableQueryType.LabelValues,
            label: 'sol',
            stream: 'stream',
            refId,
        });
    }));
    test('Migrates legacy string queries to LokiVariableQuery instances', () => __awaiter(void 0, void 0, void 0, function* () {
        const query = 'label_values(log stream selector, luna)';
        // @ts-expect-error
        render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: () => { }, query: query })));
        yield waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
    }));
    test('Receives a query instance and assigns its values when editing', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: () => { }, query: {
                type: LokiVariableQueryType.LabelValues,
                label: 'luna',
                stream: 'log stream selector',
                refId,
            } })));
        yield waitFor(() => expect(screen.getByText('Label values')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByText('luna')).toBeInTheDocument());
        yield waitFor(() => expect(screen.getByDisplayValue('log stream selector')).toBeInTheDocument());
    }));
    test('Label options are not lost when selecting one', () => __awaiter(void 0, void 0, void 0, function* () {
        const { rerender } = render(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { onChange: () => { } })));
        yield selectOptionInTest(screen.getByLabelText('Query type'), 'Label values');
        yield selectOptionInTest(screen.getByLabelText('Label'), 'luna');
        const updatedQuery = {
            refId: 'test',
            type: LokiVariableQueryType.LabelValues,
            label: 'luna',
        };
        rerender(React.createElement(LokiVariableQueryEditor, Object.assign({}, props, { query: updatedQuery, onChange: () => { } })));
        yield selectOptionInTest(screen.getByLabelText('Label'), 'moon');
        yield selectOptionInTest(screen.getByLabelText('Label'), 'luna');
        yield screen.findByText('luna');
    }));
});
//# sourceMappingURL=VariableQueryEditor.test.js.map