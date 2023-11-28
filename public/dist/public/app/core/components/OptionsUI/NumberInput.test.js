import { __awaiter } from "tslib";
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { NumberInput } from './NumberInput';
const setup = (min, max) => {
    var _a;
    const onChange = jest.fn();
    render(React.createElement(NumberInput, { value: 15, onChange: onChange, max: max, min: min }));
    return {
        input: (_a = screen.getByTestId('input-wrapper').firstChild) === null || _a === void 0 ? void 0 : _a.firstChild,
        onChange,
    };
};
describe('NumberInput', () => {
    it('updated input correctly', () => {
        const data = setup();
        const tests = [
            {
                value: '-10',
                expected: -10,
                onChangeCalledWith: -10,
            },
            {
                value: '',
                expected: null,
                onChangeCalledWith: undefined,
            },
            {
                value: '100',
                expected: 100,
                onChangeCalledWith: 100,
            },
            {
                value: '1asd',
                expected: null,
                onChangeCalledWith: undefined,
            },
            {
                value: -100,
                expected: -100,
                onChangeCalledWith: -100,
            },
            {
                value: 20,
                expected: 20,
                onChangeCalledWith: 20,
            },
            {
                value: 0,
                expected: 0,
                onChangeCalledWith: 0,
            },
            {
                value: '0',
                expected: 0,
                onChangeCalledWith: 0,
            },
        ];
        tests.forEach((test, i) => {
            fireEvent.blur(data.input, { target: { value: test.value } });
            expect(data.onChange).toBeCalledWith(test.onChangeCalledWith);
            expect(data.onChange).toBeCalledTimes(i + 1);
            expect(data.input).toHaveValue(test.expected);
        });
    });
    it('corrects input as per min and max', () => __awaiter(void 0, void 0, void 0, function* () {
        const data = setup(-10, 10);
        let input = data.input;
        const tests = [
            {
                value: '-10',
                expected: -10,
                onChangeCalledWith: -10,
            },
            {
                value: '-100',
                expected: -10,
                onChangeCalledWith: -10,
            },
            {
                value: '10',
                expected: 10,
                onChangeCalledWith: 10,
            },
            {
                value: '100',
                expected: 10,
                onChangeCalledWith: 10,
            },
            {
                value: '5',
                expected: 5,
                onChangeCalledWith: 5,
            },
        ];
        tests.forEach((test, i) => {
            var _a, _b;
            input = (_a = screen.getByTestId('input-wrapper').firstChild) === null || _a === void 0 ? void 0 : _a.firstChild;
            fireEvent.blur(input, { target: { value: test.value } });
            expect(data.onChange).toBeCalledWith(test.onChangeCalledWith);
            expect(data.onChange).toBeCalledTimes(i + 1);
            expect((_b = screen.getByTestId('input-wrapper').firstChild) === null || _b === void 0 ? void 0 : _b.firstChild).toHaveValue(test.expected);
        });
    }));
});
//# sourceMappingURL=NumberInput.test.js.map