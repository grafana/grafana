import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { toDataFrame, FieldType } from '@grafana/data';
import { fireEvent, render, screen } from '@testing-library/react';
import { selectOptionInTest } from '@grafana/ui';
import { ConfigFromQueryTransformerEditor } from './ConfigFromQueryTransformerEditor';
beforeEach(function () {
    jest.clearAllMocks();
});
var input = toDataFrame({
    fields: [
        { name: 'Name', type: FieldType.string, values: ['Temperature', 'Pressure'] },
        { name: 'Value', type: FieldType.number, values: [10, 200] },
        { name: 'Unit', type: FieldType.string, values: ['degree', 'pressurebar'] },
        { name: 'Miiin', type: FieldType.number, values: [3, 100] },
        { name: 'max', type: FieldType.string, values: [15, 200] },
    ],
    refId: 'A',
});
var mockOnChange = jest.fn();
var props = {
    input: [input],
    onChange: mockOnChange,
    options: {
        mappings: [],
    },
};
var setup = function (testProps) {
    var editorProps = __assign(__assign({}, props), testProps);
    return render(React.createElement(ConfigFromQueryTransformerEditor, __assign({}, editorProps)));
};
describe('ConfigFromQueryTransformerEditor', function () {
    it('Should be able to select config frame by refId', function () { return __awaiter(void 0, void 0, void 0, function () {
        var select;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setup();
                    return [4 /*yield*/, screen.findByText('Config query')];
                case 1:
                    select = (_a.sent()).nextSibling;
                    return [4 /*yield*/, fireEvent.keyDown(select, { keyCode: 40 })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, selectOptionInTest(select, 'A')];
                case 3:
                    _a.sent();
                    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({
                        configRefId: 'A',
                    }));
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=ConfigFromQueryTransformerEditor.test.js.map