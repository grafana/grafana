import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { toDataFrame, FieldType } from '@grafana/data';
import { fireEvent, render, screen, getByText, getByLabelText } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';
import { FieldToConfigMappingEditor } from './FieldToConfigMappingEditor';
beforeEach(function () {
    jest.clearAllMocks();
});
var frame = toDataFrame({
    fields: [
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Miiin', type: FieldType.number, values: [3, 100] },
        { name: 'max', type: FieldType.string, values: [15, 200] },
    ],
});
var mockOnChange = jest.fn();
var props = {
    frame: frame,
    onChange: mockOnChange,
    mappings: [],
    withReducers: true,
};
var setup = function (testProps) {
    var editorProps = __assign(__assign({}, props), testProps);
    return render(React.createElement(FieldToConfigMappingEditor, __assign({}, editorProps)));
};
describe('FieldToConfigMappingEditor', function () {
    it('Should render fields', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setup();
                    _a = expect;
                    return [4 /*yield*/, screen.findByText('Unit')];
                case 1:
                    _a.apply(void 0, [_e.sent()]).toBeInTheDocument();
                    _b = expect;
                    return [4 /*yield*/, screen.findByText('Miiin')];
                case 2:
                    _b.apply(void 0, [_e.sent()]).toBeInTheDocument();
                    _c = expect;
                    return [4 /*yield*/, screen.findByText('max')];
                case 3:
                    _c.apply(void 0, [_e.sent()]).toBeInTheDocument();
                    _d = expect;
                    return [4 /*yield*/, screen.findByText('Max (auto)')];
                case 4:
                    _d.apply(void 0, [_e.sent()]).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Can change mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
        var select;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup();
                    return [4 /*yield*/, screen.findByTestId('Miiin-config-key')];
                case 1:
                    select = (_a.sent()).childNodes[0];
                    return [4 /*yield*/, fireEvent.keyDown(select, { keyCode: 40 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, selectOptionInTest(select, 'Min')];
                case 3:
                    _a.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([{ fieldName: 'Miiin', handlerKey: 'min' }]));
                    return [2 /*return*/];
            }
        });
    }); });
    it('Can remove added mapping', function () { return __awaiter(void 0, void 0, void 0, function () {
        var select;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({ mappings: [{ fieldName: 'max', handlerKey: 'min' }] });
                    return [4 /*yield*/, screen.findByTestId('max-config-key')];
                case 1:
                    select = (_a.sent()).childNodes[0];
                    return [4 /*yield*/, userEvent.click(getByLabelText(select, 'select-clear-value'))];
                case 2:
                    _a.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([]));
                    return [2 /*return*/];
            }
        });
    }); });
    it('Automatic mapping is shown as placeholder', function () { return __awaiter(void 0, void 0, void 0, function () {
        var select;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({ mappings: [] });
                    return [4 /*yield*/, screen.findByText('Max (auto)')];
                case 1:
                    select = _a.sent();
                    expect(select).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Should show correct default reducer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var reducer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup({ mappings: [{ fieldName: 'max', handlerKey: 'mappings.value' }] });
                    return [4 /*yield*/, screen.findByTestId('max-reducer')];
                case 1:
                    reducer = _a.sent();
                    expect(getByText(reducer, 'All values')).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Can change reducer', function () { return __awaiter(void 0, void 0, void 0, function () {
        var reducer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup();
                    return [4 /*yield*/, screen.findByTestId('max-reducer')];
                case 1: return [4 /*yield*/, (_a.sent()).childNodes[0]];
                case 2:
                    reducer = _a.sent();
                    return [4 /*yield*/, fireEvent.keyDown(reducer, { keyCode: 40 })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, selectOptionInTest(reducer, 'Last')];
                case 4:
                    _a.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.arrayContaining([{ fieldName: 'max', handlerKey: 'max', reducerId: 'last' }]));
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=FieldToConfigMappingEditor.test.js.map