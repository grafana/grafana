import { __awaiter } from "tslib";
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { LokiOptionFields, preprocessMaxLines } from './LokiOptionFields';
const setup = () => {
    const lineLimitValue = '1';
    const resolution = 1;
    const query = { refId: '1', expr: 'query' };
    const onChange = jest.fn();
    const onRunQuery = jest.fn();
    const props = {
        lineLimitValue,
        resolution,
        query,
        onChange,
        onRunQuery,
    };
    return props;
};
describe('Query Type Field', () => {
    it('should render a query type field', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(screen.getByTestId('queryTypeField')).toBeInTheDocument();
    });
    it('should have a default value of "Range"', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(screen.getByLabelText('Range')).toBeChecked();
        expect(screen.getByLabelText('Instant')).not.toBeChecked();
    });
    it('should call onChange when value is changed', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        fireEvent.click(screen.getByLabelText('Instant')); // (`userEvent.click()` triggers an error, so switching here to `fireEvent`.)
        yield waitFor(() => expect(props.onChange).toHaveBeenCalledTimes(1));
    }));
    it('renders as expected when the query type is instant', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props, { query: { refId: '1', expr: 'query', instant: true } })));
        expect(screen.getByLabelText('Instant')).toBeChecked();
        expect(screen.getByLabelText('Range')).not.toBeChecked();
    });
});
describe('Line Limit Field', () => {
    it('should render a line limit field', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });
    it('should have a default value of 1', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(screen.getByRole('spinbutton')).toHaveValue(1);
    });
    it('displays the expected line limit value', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props, { lineLimitValue: "123" })));
        expect(screen.getByRole('spinbutton')).toHaveValue(123);
    });
});
describe('Resolution Field', () => {
    it('should render the resolution field', () => {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
    it('should have a default value of 1', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props)));
        expect(yield screen.findByText('1/1')).toBeInTheDocument();
    }));
    it('displays the expected resolution value', () => __awaiter(void 0, void 0, void 0, function* () {
        const props = setup();
        render(React.createElement(LokiOptionFields, Object.assign({}, props, { resolution: 5 })));
        expect(yield screen.findByText('1/5')).toBeInTheDocument();
    }));
});
describe('preprocessMaxLines', () => {
    test.each([
        { inputValue: '', expected: undefined },
        { inputValue: 'abc', expected: undefined },
        { inputValue: '-1', expected: undefined },
        { inputValue: '1', expected: 1 },
        { inputValue: '100', expected: 100 },
    ])('should return correct max lines value', ({ inputValue, expected }) => {
        expect(preprocessMaxLines(inputValue)).toBe(expected);
    });
});
//# sourceMappingURL=LokiOptionFields.test.js.map