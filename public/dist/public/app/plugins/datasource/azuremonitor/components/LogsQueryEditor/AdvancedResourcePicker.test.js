import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AdvancedResourcePicker from './AdvancedResourcePicker';
describe('AdvancedResourcePicker', () => {
    it('should set a parameter as an object', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const { rerender } = render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [''] }));
        const subsInput = yield screen.findByTestId('input-advanced-resource-picker-1');
        yield userEvent.type(subsInput, 'd');
        expect(onChange).toHaveBeenCalledWith(['d']);
        rerender(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: ['/subscriptions/def-123'] }));
        expect(screen.getByDisplayValue('/subscriptions/def-123')).toBeInTheDocument();
    }));
    it('should initialize with an empty resource', () => {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [] }));
        expect(onChange).toHaveBeenCalledWith(['']);
    });
    it('should add a resource', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: ['/subscriptions/def-123'] }));
        const addButton = yield screen.findByText('Add resource URI');
        addButton.click();
        expect(onChange).toHaveBeenCalledWith(['/subscriptions/def-123', '']);
    }));
    it('should remove a resource', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: ['/subscriptions/def-123'] }));
        const removeButton = yield screen.findByTestId('remove-resource');
        removeButton.click();
        expect(onChange).toHaveBeenCalledWith([]);
    }));
    it('should render multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AdvancedResourcePicker, { onChange: jest.fn(), resources: ['/subscriptions/def-123', '/subscriptions/def-456'] }));
        expect(screen.getByDisplayValue('/subscriptions/def-123')).toBeInTheDocument();
        expect(screen.getByDisplayValue('/subscriptions/def-456')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AdvancedResourcePicker.test.js.map