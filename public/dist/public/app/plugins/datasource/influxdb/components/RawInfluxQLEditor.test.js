import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
var query = {
    refId: 'A',
    query: 'test query 1',
    resultFormat: 'table',
    alias: 'alias42',
};
describe('RawInfluxQLEditor', function () {
    it('should render', function () {
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: function () { return null; }, onChange: function () { return null; }, query: query }));
        var queryTextarea = screen.getByLabelText('query');
        var aliasInput = screen.getByLabelText('Alias by');
        var formatSelect = screen.getByLabelText('Format as');
        expect(formatSelect).toBeInTheDocument();
        expect(queryTextarea).toBeInTheDocument();
        expect(aliasInput).toBeInTheDocument();
        expect(queryTextarea).toHaveValue('test query 1');
        expect(aliasInput).toHaveValue('alias42');
        // the only way to validate the text-displayed on the select-box
        expect(screen.getByText('Table')).toBeInTheDocument();
    });
    it('should handle no-alias, no-query, no-resultFormat', function () {
        var emptyQuery = { refId: 'B' };
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: function () { return null; }, onChange: function () { return null; }, query: emptyQuery }));
        var queryTextarea = screen.getByLabelText('query');
        var aliasInput = screen.getByLabelText('Alias by');
        var formatSelect = screen.getByLabelText('Format as');
        expect(formatSelect).toBeInTheDocument();
        expect(queryTextarea).toBeInTheDocument();
        expect(aliasInput).toBeInTheDocument();
        expect(queryTextarea).toHaveValue('');
        expect(aliasInput).toHaveValue('');
        // the only way to validate the text-displayed on the select-box
        expect(screen.getByText('Time series')).toBeInTheDocument();
    });
    it('should call onChange immediately when resultFormat change', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, formatSelect;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    onChange = jest.fn();
                    render(React.createElement(RawInfluxQLEditor, { onRunQuery: function () { return null; }, onChange: onChange, query: query }));
                    formatSelect = screen.getByLabelText('Format as');
                    expect(formatSelect).toBeInTheDocument();
                    return [4 /*yield*/, selectOptionInTest(formatSelect, 'Time series')];
                case 1:
                    _a.sent();
                    expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, query), { resultFormat: 'time_series' }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('should only call onChange on blur when query changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, queryTextarea, aliasInput;
        return __generator(this, function (_a) {
            onChange = jest.fn();
            render(React.createElement(RawInfluxQLEditor, { onRunQuery: function () { return null; }, onChange: onChange, query: query }));
            queryTextarea = screen.getByLabelText('query');
            expect(queryTextarea).toBeInTheDocument();
            aliasInput = screen.getByLabelText('Alias by');
            expect(aliasInput).toBeInTheDocument();
            // value before
            expect(queryTextarea).toHaveValue('test query 1');
            userEvent.type(queryTextarea, 'new changes');
            // the field should have a new value, but no onChange yet.
            expect(queryTextarea).toHaveValue('test query 1new changes');
            expect(onChange).toHaveBeenCalledTimes(0);
            aliasInput.focus(); // this should trigger blur on queryTextarea
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, query), { query: 'test query 1new changes' }));
            return [2 /*return*/];
        });
    }); });
    it('should only call onChange on blur when alias changes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var onChange, queryTextarea, aliasInput;
        return __generator(this, function (_a) {
            onChange = jest.fn();
            render(React.createElement(RawInfluxQLEditor, { onRunQuery: function () { return null; }, onChange: onChange, query: query }));
            queryTextarea = screen.getByLabelText('query');
            expect(queryTextarea).toBeInTheDocument();
            aliasInput = screen.getByLabelText('Alias by');
            expect(aliasInput).toBeInTheDocument();
            // value before
            expect(aliasInput).toHaveValue('alias42');
            userEvent.type(aliasInput, 'new changes');
            // the field should have a new value, but no onChange yet.
            expect(aliasInput).toHaveValue('alias42new changes');
            expect(onChange).toHaveBeenCalledTimes(0);
            queryTextarea.focus(); // this should trigger blur on queryTextarea
            expect(onChange).toHaveBeenCalledTimes(1);
            expect(onChange).toHaveBeenCalledWith(__assign(__assign({}, query), { alias: 'alias42new changes' }));
            return [2 /*return*/];
        });
    }); });
});
//# sourceMappingURL=RawInfluxQLEditor.test.js.map