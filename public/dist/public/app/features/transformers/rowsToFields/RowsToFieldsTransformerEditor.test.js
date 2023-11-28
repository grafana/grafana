import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { toDataFrame, FieldType } from '@grafana/data';
import { RowsToFieldsTransformerEditor } from './RowsToFieldsTransformerEditor';
beforeEach(() => {
    jest.clearAllMocks();
});
const input = toDataFrame({
    fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
        { name: 'Value', type: FieldType.number, values: [10, 200] },
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Miiin', type: FieldType.number, values: [3, 100] },
        { name: 'max', type: FieldType.string, values: [15, 200] },
    ],
});
const mockOnChange = jest.fn();
const props = {
    input: [input],
    onChange: mockOnChange,
    options: {},
};
const setup = (testProps) => {
    const editorProps = Object.assign(Object.assign({}, props), testProps);
    return render(React.createElement(RowsToFieldsTransformerEditor, Object.assign({}, editorProps)));
};
describe('RowsToFieldsTransformerEditor', () => {
    it('Should be able to select name field', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const select = (yield screen.findByTestId('Name-config-key')).childNodes[0];
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield selectOptionInTest(select, 'Field name');
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            mappings: [{ fieldName: 'Name', handlerKey: 'field.name' }],
        }));
    }));
    it('Should be able to select value field', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const select = (yield screen.findByTestId('Value-config-key')).childNodes[0];
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield selectOptionInTest(select, 'Field value');
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            mappings: [{ fieldName: 'Value', handlerKey: 'field.value' }],
        }));
    }));
});
//# sourceMappingURL=RowsToFieldsTransformerEditor.test.js.map