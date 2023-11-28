import { __awaiter } from "tslib";
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { invalidTimeShiftError } from '../TraceToLogs/TraceToLogsSettings';
import { IntervalInput } from './IntervalInput';
describe('IntervalInput', () => {
    const IntervalInputtWithProps = ({ val }) => {
        const [value, setValue] = useState(val);
        return (React.createElement(IntervalInput, { label: "", tooltip: "", value: value, disabled: false, onChange: (v) => {
                setValue(v);
            }, isInvalidError: invalidTimeShiftError }));
    };
    describe('validates time shift correctly', () => {
        it('for previosuly saved invalid value', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(IntervalInputtWithProps, { val: "77" }));
            expect(screen.getByDisplayValue('77')).toBeInTheDocument();
            expect(screen.getByText(invalidTimeShiftError)).toBeInTheDocument();
        }));
        it('for previously saved empty value', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(IntervalInputtWithProps, { val: "" }));
            expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
            expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
        }));
        it('for empty (valid) value', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(IntervalInputtWithProps, { val: "1ms" }));
            yield userEvent.clear(screen.getByDisplayValue('1ms'));
            yield waitFor(() => {
                expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
            });
        }));
        it('for valid value', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(IntervalInputtWithProps, { val: "10ms" }));
            expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
            const input = screen.getByDisplayValue('10ms');
            yield userEvent.clear(input);
            yield userEvent.type(input, '100s');
            yield waitFor(() => {
                expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
            });
            yield userEvent.clear(input);
            yield userEvent.type(input, '-77ms');
            yield waitFor(() => {
                expect(screen.queryByText(invalidTimeShiftError)).not.toBeInTheDocument();
            });
        }));
        it('for invalid value', () => __awaiter(void 0, void 0, void 0, function* () {
            render(React.createElement(IntervalInputtWithProps, { val: "10ms" }));
            const input = screen.getByDisplayValue('10ms');
            yield userEvent.clear(input);
            yield userEvent.type(input, 'abc');
            yield waitFor(() => {
                expect(screen.queryByText(invalidTimeShiftError)).toBeInTheDocument();
            });
        }));
    });
});
//# sourceMappingURL=IntervalInput.test.js.map