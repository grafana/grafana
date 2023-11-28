import { __awaiter } from "tslib";
import { fireEvent, render, screen, getByText, getByLabelText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { toDataFrame, FieldType } from '@grafana/data';
import { FieldToConfigMappingEditor } from './FieldToConfigMappingEditor';
beforeEach(() => {
    jest.clearAllMocks();
});
const frame = toDataFrame({
    fields: [
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Miiin', type: FieldType.number, values: [3, 100] },
        { name: 'max', type: FieldType.string, values: [15, 200] },
    ],
});
const mockOnChange = jest.fn();
const props = {
    frame: frame,
    onChange: mockOnChange,
    mappings: [],
    withReducers: true,
};
const setup = (testProps) => {
    const editorProps = Object.assign(Object.assign({}, props), testProps);
    return render(React.createElement(FieldToConfigMappingEditor, Object.assign({}, editorProps)));
};
describe('FieldToConfigMappingEditor', () => {
    it('Should render fields', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        expect(yield screen.findByText('Unit')).toBeInTheDocument();
        expect(yield screen.findByText('Miiin')).toBeInTheDocument();
        expect(yield screen.findByText('max')).toBeInTheDocument();
        expect(yield screen.findByText('Max (auto)')).toBeInTheDocument();
    }));
    it('Can change mapping', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const select = (yield screen.findByTestId('Miiin-config-key')).childNodes[0];
        yield fireEvent.keyDown(select, { keyCode: 40 });
        yield selectOptionInTest(select, 'Min');
        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([{ fieldName: 'Miiin', handlerKey: 'min' }]));
    }));
    it('Can remove added mapping', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ mappings: [{ fieldName: 'max', handlerKey: 'min' }] });
        const select = (yield screen.findByTestId('max-config-key')).childNodes[0];
        yield userEvent.click(getByLabelText(select, 'select-clear-value'));
        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([]));
    }));
    it('Automatic mapping is shown as placeholder', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ mappings: [] });
        const select = yield screen.findByText('Max (auto)');
        expect(select).toBeInTheDocument();
    }));
    it('Should show correct default reducer', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ mappings: [{ fieldName: 'max', handlerKey: 'mappings.value' }] });
        const reducer = yield screen.findByTestId('max-reducer');
        expect(getByText(reducer, 'All values')).toBeInTheDocument();
    }));
    it('Can change reducer', () => __awaiter(void 0, void 0, void 0, function* () {
        setup();
        const reducer = yield (yield screen.findByTestId('max-reducer')).childNodes[0];
        yield fireEvent.keyDown(reducer, { keyCode: 40 });
        yield selectOptionInTest(reducer, 'Last');
        expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([{ fieldName: 'max', handlerKey: 'max', reducerId: 'last' }]));
    }));
});
//# sourceMappingURL=FieldToConfigMappingEditor.test.js.map