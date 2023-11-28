import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Select, InlineField } from '@grafana/ui';
import { useCreatableSelectPersistedBehaviour } from './useCreatableSelectPersistedBehaviour';
describe('useCreatableSelectPersistedBehaviour', () => {
    it('Should make a Select accept custom values', () => __awaiter(void 0, void 0, void 0, function* () {
        const MyComp = (_) => (React.createElement(InlineField, { label: "label" },
            React.createElement(Select, Object.assign({ inputId: "select" }, useCreatableSelectPersistedBehaviour({
                options: [{ label: 'Option 1', value: 'Option 1' }],
                onChange() { },
            })))));
        const { rerender } = render(React.createElement(MyComp, null));
        const input = screen.getByLabelText('label');
        expect(input).toBeInTheDocument();
        // we open the menu
        yield userEvent.click(input);
        expect(screen.getByText('Option 1')).toBeInTheDocument();
        // we type in the input 'Option 2', which should prompt an option creation
        yield userEvent.type(input, 'Option 2');
        const creatableOption = screen.getByLabelText('Select option');
        expect(creatableOption).toHaveTextContent('Option 2');
        // we click on the creatable option to trigger its creation
        yield userEvent.click(creatableOption);
        // Forcing a rerender
        rerender(React.createElement(MyComp, { force: true }));
        // we open the menu again
        yield userEvent.click(input);
        // the created option should be available
        expect(screen.getByText('Option 2')).toBeInTheDocument();
    }));
    it('Should handle onChange properly', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const MyComp = () => (React.createElement(InlineField, { label: "label" },
            React.createElement(Select, Object.assign({ inputId: "select" }, useCreatableSelectPersistedBehaviour({
                options: [{ label: 'Option 1', value: 'Option 1' }],
                onChange,
            })))));
        render(React.createElement(MyComp, null));
        const input = screen.getByLabelText('label');
        expect(input).toBeInTheDocument();
        // we open the menu
        yield userEvent.click(input);
        const option1 = screen.getByText('Option 1');
        expect(option1).toBeInTheDocument();
        // Should call onChange when selecting an already existing option
        yield userEvent.click(option1);
        expect(onChange).toHaveBeenLastCalledWith({ value: 'Option 1', label: 'Option 1' }, { action: 'select-option', name: undefined, option: undefined });
        yield userEvent.click(input);
        // we type in the input 'Option 2', which should prompt an option creation
        yield userEvent.type(input, 'Option 2');
        yield userEvent.click(screen.getByLabelText('Select option'));
        expect(onChange).toHaveBeenLastCalledWith({ value: 'Option 2' });
    }));
    it('Should create an option for value if value is not in options', () => __awaiter(void 0, void 0, void 0, function* () {
        const MyComp = (_) => (React.createElement(InlineField, { label: "label" },
            React.createElement(Select, Object.assign({ inputId: "select" }, useCreatableSelectPersistedBehaviour({
                options: [{ label: 'Option 1', value: 'Option 1' }],
                value: 'Option 2',
                onChange() { },
            })))));
        render(React.createElement(MyComp, null));
        const input = screen.getByLabelText('label');
        expect(input).toBeInTheDocument();
        // we open the menu
        yield userEvent.click(input);
        // we expect 2 elemnts having "Option 2": the input itself and the option.
        expect(screen.getAllByText('Option 2')).toHaveLength(2);
    }));
});
//# sourceMappingURL=useCreatableSelectPersistedBehaviour.test.js.map