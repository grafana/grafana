import { __awaiter, __generator } from "tslib";
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { createMockResourcePickerRows } from '../../__mocks__/resourcePickerRows';
import NestedResourceTable from './NestedResourceTable';
import { findRow } from './utils';
describe('AzureMonitor NestedResourceTable', function () {
    var noop = function () { };
    it('renders subscriptions', function () {
        var rows = createMockResourcePickerRows();
        render(React.createElement(NestedResourceTable, { rows: rows, selectedRows: [], requestNestedRows: noop, onRowSelectedChange: noop }));
        expect(screen.getByText('Primary Subscription')).toBeInTheDocument();
        expect(screen.getByText('Dev Subscription')).toBeInTheDocument();
    });
    it('opens to the selected resource', function () {
        var rows = createMockResourcePickerRows();
        var selected = findRow(rows, '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk');
        if (!selected) {
            throw new Error("couldn't find row, test data stale");
        }
        render(React.createElement(NestedResourceTable, { rows: rows, selectedRows: [selected], requestNestedRows: noop, onRowSelectedChange: noop }));
        expect(screen.getByText('web-server_DataDisk')).toBeInTheDocument();
    });
    it("expands resource groups when they're clicked", function () { return __awaiter(void 0, void 0, void 0, function () {
        var rows, promise, requestNestedRows, expandButton;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rows = createMockResourcePickerRows();
                    promise = Promise.resolve();
                    requestNestedRows = jest.fn().mockReturnValue(promise);
                    render(React.createElement(NestedResourceTable, { rows: rows, selectedRows: [], requestNestedRows: requestNestedRows, onRowSelectedChange: noop }));
                    expandButton = screen.getAllByLabelText('Expand')[2];
                    userEvent.click(expandButton);
                    expect(requestNestedRows).toBeCalledWith(expect.objectContaining({
                        id: '/subscriptions/def-456/resourceGroups/dev',
                        name: 'Development',
                        typeLabel: 'Resource Group',
                    }));
                    return [4 /*yield*/, act(function () { return promise; })];
                case 1:
                    _a.sent();
                    expect(screen.getByText('web-server')).toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('supports selecting variables', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rows, promise, requestNestedRows, onRowSelectedChange, expandButton, checkbox;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    rows = createMockResourcePickerRows();
                    promise = Promise.resolve();
                    requestNestedRows = jest.fn().mockReturnValue(promise);
                    onRowSelectedChange = jest.fn();
                    render(React.createElement(NestedResourceTable, { rows: rows, selectedRows: [], requestNestedRows: requestNestedRows, onRowSelectedChange: onRowSelectedChange }));
                    expandButton = screen.getAllByLabelText('Expand')[5];
                    userEvent.click(expandButton);
                    return [4 /*yield*/, act(function () { return promise; })];
                case 1:
                    _a.sent();
                    checkbox = screen.getByLabelText('$workspace');
                    userEvent.click(checkbox);
                    expect(onRowSelectedChange).toHaveBeenCalledWith(expect.objectContaining({
                        id: '$workspace',
                        name: '$workspace',
                    }), true);
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=NestedResourceTable.test.js.map