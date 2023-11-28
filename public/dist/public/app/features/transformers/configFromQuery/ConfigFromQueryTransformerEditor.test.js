import { __awaiter } from "tslib";
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { toDataFrame, FieldType } from '@grafana/data';
import { ConfigFromQueryTransformerEditor } from './ConfigFromQueryTransformerEditor';
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
    refId: 'A',
});
const mockOnChange = jest.fn();
const props = {
    input: [input],
    onChange: mockOnChange,
    options: {
        mappings: [],
    },
};
const setup = (testProps) => {
    const editorProps = Object.assign(Object.assign({}, props), testProps);
    return render(React.createElement(ConfigFromQueryTransformerEditor, Object.assign({}, editorProps)));
};
describe('ConfigFromQueryTransformerEditor', () => {
    it('Should be able to select config frame by refId', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        let select = (yield screen.findByText('Config query')).nextSibling.firstChild;
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield selectOptionInTest(select, 'A');
        expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
            configRefId: 'A',
        }));
    }));
});
//# sourceMappingURL=ConfigFromQueryTransformerEditor.test.js.map