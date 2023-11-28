import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { RawInfluxQLEditor } from './RawInfluxQLEditor';
const query = {
    refId: 'A',
    query: 'test query 1',
    resultFormat: 'table',
    alias: 'alias42',
};
describe('RawInfluxQLEditor', () => {
    it('should render', () => {
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: () => null, onChange: () => null, query: query }));
        const queryTextarea = screen.getByLabelText('query');
        const aliasInput = screen.getByLabelText('Alias by');
        const formatSelect = screen.getByLabelText('Format as');
        expect(formatSelect).toBeInTheDocument();
        expect(queryTextarea).toBeInTheDocument();
        expect(aliasInput).toBeInTheDocument();
        expect(queryTextarea).toHaveValue('test query 1');
        expect(aliasInput).toHaveValue('alias42');
        // the only way to validate the text-displayed on the select-box
        expect(screen.getByText('Table')).toBeInTheDocument();
    });
    it('should handle no-alias, no-query, no-resultFormat', () => {
        const emptyQuery = { refId: 'B' };
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: () => null, onChange: () => null, query: emptyQuery }));
        const queryTextarea = screen.getByLabelText('query');
        const aliasInput = screen.getByLabelText('Alias by');
        const formatSelect = screen.getByLabelText('Format as');
        expect(formatSelect).toBeInTheDocument();
        expect(queryTextarea).toBeInTheDocument();
        expect(aliasInput).toBeInTheDocument();
        expect(queryTextarea).toHaveValue('');
        expect(aliasInput).toHaveValue('');
        // the only way to validate the text-displayed on the select-box
        expect(screen.getByText('Time series')).toBeInTheDocument();
    });
    it('should call onChange immediately when resultFormat change', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: () => null, onChange: onChange, query: query }));
        const formatSelect = screen.getByLabelText('Format as');
        expect(formatSelect).toBeInTheDocument();
        yield selectOptionInTest(formatSelect, 'Time series');
        expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, query), { resultFormat: 'time_series' }));
    }));
    it('should only call onChange on blur when query changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: () => null, onChange: onChange, query: query }));
        const queryTextarea = screen.getByLabelText('query');
        expect(queryTextarea).toBeInTheDocument();
        const aliasInput = screen.getByLabelText('Alias by');
        expect(aliasInput).toBeInTheDocument();
        // value before
        expect(queryTextarea).toHaveValue('test query 1');
        yield userEvent.type(queryTextarea, 'new changes');
        // the field should have a new value, but no onChange yet.
        expect(queryTextarea).toHaveValue('test query 1new changes');
        expect(onChange).toHaveBeenCalledTimes(0);
        aliasInput.focus(); // this should trigger blur on queryTextarea
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, query), { query: 'test query 1new changes' }));
    }));
    it('should only call onChange on blur when alias changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(RawInfluxQLEditor, { onRunQuery: () => null, onChange: onChange, query: query }));
        const queryTextarea = screen.getByLabelText('query');
        expect(queryTextarea).toBeInTheDocument();
        const aliasInput = screen.getByLabelText('Alias by');
        expect(aliasInput).toBeInTheDocument();
        // value before
        expect(aliasInput).toHaveValue('alias42');
        yield userEvent.type(aliasInput, 'new changes');
        // the field should have a new value, but no onChange yet.
        expect(aliasInput).toHaveValue('alias42new changes');
        expect(onChange).toHaveBeenCalledTimes(0);
        queryTextarea.focus(); // this should trigger blur on queryTextarea
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, query), { alias: 'alias42new changes' }));
    }));
});
//# sourceMappingURL=RawInfluxQLEditor.test.js.map