import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import React from 'react';
import { select, openMenu } from 'react-select-event';
import { MetricSelect } from './MetricSelect';
const props = {
    isSearchable: false,
    onChange: jest.fn(),
    value: '',
    placeholder: 'Select Reducer',
    className: 'width-15',
    options: [
        {
            label: 'foo',
            value: 'foo',
        },
        {
            label: 'bar',
            value: 'bar',
        },
    ],
    variables: [],
};
describe('MetricSelect', () => {
    it('passes the placeholder, options and onChange correctly to Select', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(MetricSelect, Object.assign({}, props)));
        const metricSelect = screen.getByRole('combobox');
        expect(metricSelect).toBeInTheDocument();
        expect(screen.getByText('Select Reducer')).toBeInTheDocument();
        yield select(metricSelect, 'foo', {
            container: document.body,
        });
        expect(props.onChange).toHaveBeenCalledWith('foo');
    }));
    it('has the correct noOptionsMessage', () => {
        const propsWithoutOptions = Object.assign(Object.assign({}, props), { options: [] });
        render(React.createElement(MetricSelect, Object.assign({}, propsWithoutOptions)));
        const metricSelect = screen.getByRole('combobox');
        expect(metricSelect).toBeInTheDocument();
        openMenu(metricSelect);
        expect(screen.getByText('No options found')).toBeInTheDocument();
    });
});
//# sourceMappingURL=MetricSelect.test.js.map