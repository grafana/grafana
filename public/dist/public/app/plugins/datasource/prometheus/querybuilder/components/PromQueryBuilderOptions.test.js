import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { CoreApp } from '@grafana/data';
import { getQueryWithDefaults } from '../state';
import { PromQueryBuilderOptions } from './PromQueryBuilderOptions';
describe('PromQueryBuilderOptions', () => {
    it('Can change query type', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup();
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByLabelText('Range')).toBeChecked();
        yield userEvent.click(screen.getByLabelText('Instant'));
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { instant: true, range: false, exemplar: false }));
    }));
    it('Can set query type to "Both" on render for PanelEditor', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ instant: true, range: true });
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByLabelText('Both')).toBeChecked();
    }));
    it('Can set query type to "Both" on render for Explorer', () => __awaiter(void 0, void 0, void 0, function* () {
        setup({ instant: true, range: true }, CoreApp.Explore);
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        expect(screen.getByLabelText('Both')).toBeChecked();
    }));
    it('Legend format default to Auto', () => {
        setup();
        expect(screen.getByText('Legend: Auto')).toBeInTheDocument();
    });
    it('Can change legend format to verbose', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup();
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        let legendModeSelect = screen.getByText('Auto').parentElement;
        yield userEvent.click(legendModeSelect);
        yield selectOptionInTest(legendModeSelect, 'Verbose');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { legendFormat: '' }));
    }));
    it('Can change legend format to custom', () => __awaiter(void 0, void 0, void 0, function* () {
        const { props } = setup();
        yield userEvent.click(screen.getByRole('button', { name: /Options/ }));
        let legendModeSelect = screen.getByText('Auto').parentElement;
        yield userEvent.click(legendModeSelect);
        yield selectOptionInTest(legendModeSelect, 'Custom');
        expect(props.onChange).toHaveBeenCalledWith(Object.assign(Object.assign({}, props.query), { legendFormat: '{{label_name}}' }));
    }));
    it('Handle defaults with undefined range', () => {
        setup(getQueryWithDefaults({ refId: 'A', expr: '', range: undefined, instant: true }, CoreApp.Dashboard));
        expect(screen.getByText('Type: Instant')).toBeInTheDocument();
    });
    it('Should show "Exemplars: false" by default', () => {
        setup();
        expect(screen.getByText('Exemplars: false')).toBeInTheDocument();
    });
    it('Should show "Exemplars: false" when query has "Exemplars: false"', () => {
        setup({ exemplar: false });
        expect(screen.getByText('Exemplars: false')).toBeInTheDocument();
    });
    it('Should show "Exemplars: true" when query has "Exemplars: true"', () => {
        setup({ exemplar: true });
        expect(screen.getByText('Exemplars: true')).toBeInTheDocument();
    });
});
function setup(queryOverrides = {}, app = CoreApp.PanelEditor) {
    const props = {
        app,
        query: Object.assign(Object.assign({}, getQueryWithDefaults({
            refId: 'A',
            expr: '',
            range: true,
            instant: false,
        }, CoreApp.PanelEditor)), queryOverrides),
        onRunQuery: jest.fn(),
        onChange: jest.fn(),
        uiOptions: {
            exemplars: true,
            type: true,
            format: true,
            minStep: true,
            legend: true,
            resolution: true,
        },
    };
    const { container } = render(React.createElement(PromQueryBuilderOptions, Object.assign({}, props)));
    return { container, props };
}
//# sourceMappingURL=PromQueryBuilderOptions.test.js.map