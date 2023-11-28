import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { LokiQueryType } from '../../types';
import { LokiQueryBuilderOptions } from './LokiQueryBuilderOptions';
describe('LokiQueryBuilderOptions', () => {
    it('can change query type', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup();
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByLabelText('Range')).toBeChecked();
        yield userEvent.click(screen.getByLabelText('Instant'));
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { queryType: LokiQueryType.Instant }));
    }));
    it('can change legend format', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup();
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        // First autosize input is a Legend
        const element = screen.getAllByTestId('autosize-input')[0];
        yield userEvent.type(element, 'asd');
        yield userEvent.keyboard('{enter}');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { legendFormat: 'asd' }));
    }));
    it('can change line limit to valid value', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup({ expr: '{foo="bar"}' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        // Second autosize input is a Line limit
        const element = screen.getAllByTestId('autosize-input')[1];
        yield userEvent.type(element, '10');
        yield userEvent.keyboard('{enter}');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { maxLines: 10 }));
    }));
    it('does not change line limit to invalid numeric value', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup({ expr: '{foo="bar"}' });
        // We need to start with some value to be able to change it
        props.query.maxLines = 10;
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        // Second autosize input is a Line limit
        const element = screen.getAllByTestId('autosize-input')[1];
        yield userEvent.type(element, '-10');
        yield userEvent.keyboard('{enter}');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { maxLines: undefined }));
    }));
    it('does not change line limit to invalid text value', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup({ expr: '{foo="bar"}' });
        // We need to start with some value to be able to change it
        props.query.maxLines = 10;
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        // Second autosize input is a Line limit
        const element = screen.getAllByTestId('autosize-input')[1];
        yield userEvent.type(element, 'asd');
        yield userEvent.keyboard('{enter}');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { maxLines: undefined }));
    }));
    it('shows correct options for log query', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: '{foo="bar"}' });
        expect(screen.getByText('Line limit: 20')).toBeInTheDocument();
        expect(screen.getByText('Type: Range')).toBeInTheDocument();
        expect(screen.queryByText(/step/i)).not.toBeInTheDocument();
    }));
    it('shows correct options for metric query', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: '1m', resolution: 2 });
        expect(screen.queryByText('Line limit: 20')).not.toBeInTheDocument();
        expect(screen.getByText('Type: Range')).toBeInTheDocument();
        expect(screen.getByText('Step: 1m')).toBeInTheDocument();
        expect(screen.getByText('Resolution: 1/2')).toBeInTheDocument();
    }));
    it('does not shows resolution field if resolution is not set', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.queryByText('Resolution')).not.toBeInTheDocument();
    }));
    it('does not shows resolution field if resolution is set to default value 1', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', resolution: 1 });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.queryByText('Resolution')).not.toBeInTheDocument();
    }));
    it('does shows resolution field with warning if resolution is set to non-default value', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', resolution: 2 });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByText('Resolution')).toBeInTheDocument();
        expect(screen.getByText("The 'Resolution' is deprecated. Use 'Step' editor instead to change step parameter.")).toBeInTheDocument();
    }));
    it('shows correct options for metric query with invalid step', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: 'abc' });
        expect(screen.queryByText('Line limit: 20')).not.toBeInTheDocument();
        expect(screen.getByText('Type: Range')).toBeInTheDocument();
        expect(screen.getByText('Step: Invalid value')).toBeInTheDocument();
    }));
    it('shows error when invalid value in step', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: 'a' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByText(/Invalid step/)).toBeInTheDocument();
    }));
    it('does not shows error when valid value in step', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: '1m' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    }));
    it('does not shows error when valid millisecond value in step', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: '1ms' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    }));
    it('does not shows error when valid day value in step', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ expr: 'rate({foo="bar"}[5m]', step: '1d' });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.queryByText(/Invalid step/)).not.toBeInTheDocument();
    }));
});
function setup(queryOverrides = {}) {
    const props = {
        query: Object.assign({ refId: 'A', expr: '' }, queryOverrides),
        onRunQuery: jest.fn(),
        onChange: jest.fn(),
        maxLines: 20,
        queryStats: { streams: 0, chunks: 0, bytes: 0, entries: 0 },
    };
    const { container } = render(React.createElement(LokiQueryBuilderOptions, Object.assign({}, props)));
    return { container, props };
}
//# sourceMappingURL=LokiQueryBuilderOptions.test.js.map