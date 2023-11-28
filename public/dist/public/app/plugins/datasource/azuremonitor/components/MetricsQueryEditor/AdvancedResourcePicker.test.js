import { __awaiter } from "tslib";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import AdvancedResourcePicker from './AdvancedResourcePicker';
describe('AdvancedResourcePicker', () => {
    it('should set a parameter as an object', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        const { rerender } = render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{}] }));
        const subsInput = yield screen.findByLabelText('Subscription');
        yield userEvent.type(subsInput, 'd');
        expect(onChange).toHaveBeenCalledWith([{ subscription: 'd' }]);
        rerender(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ subscription: 'def-123' }] }));
        expect(screen.getByLabelText('Subscription').outerHTML).toMatch('value="def-123"');
    }));
    it('should initialize with an empty resource', () => {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [] }));
        expect(onChange).toHaveBeenCalledWith([{}]);
    });
    it('should add a resource', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ subscription: 'def-123' }] }));
        const addButton = yield screen.findByText('Add resource');
        addButton.click();
        expect(onChange).toHaveBeenCalledWith([
            { subscription: 'def-123' },
            { subscription: 'def-123', resourceGroup: '', resourceName: '' },
        ]);
    }));
    it('should remove a resource', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ subscription: 'def-123' }] }));
        const removeButton = yield screen.findByTestId('remove-resource');
        removeButton.click();
        expect(onChange).toHaveBeenCalledWith([]);
    }));
    it('should update all resources when editing the subscription', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ subscription: 'def-123' }, { subscription: 'def-123' }] }));
        const subsInput = yield screen.findByLabelText('Subscription');
        yield userEvent.type(subsInput, 'd');
        expect(onChange).toHaveBeenCalledWith([{ subscription: 'def-123d' }, { subscription: 'def-123d' }]);
    }));
    it('should update all resources when editing the namespace', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ metricNamespace: 'aa' }, { metricNamespace: 'aa' }] }));
        const subsInput = yield screen.findByLabelText('Namespace');
        yield userEvent.type(subsInput, 'b');
        expect(onChange).toHaveBeenCalledWith([{ metricNamespace: 'aab' }, { metricNamespace: 'aab' }]);
    }));
    it('should update all resources when editing the region', () => __awaiter(void 0, void 0, void 0, function* () {
        const onChange = jest.fn();
        render(React.createElement(AdvancedResourcePicker, { onChange: onChange, resources: [{ region: 'aa' }, { region: 'aa' }] }));
        const subsInput = yield screen.findByLabelText('Region');
        yield userEvent.type(subsInput, 'b');
        expect(onChange).toHaveBeenCalledWith([{ region: 'aab' }, { region: 'aab' }]);
    }));
    it('should render multiple resources', () => __awaiter(void 0, void 0, void 0, function* () {
        render(React.createElement(AdvancedResourcePicker, { onChange: jest.fn(), resources: [
                {
                    subscription: 'sub1',
                    metricNamespace: 'ns1',
                    resourceGroup: 'rg1',
                    resourceName: 'res1',
                },
                {
                    subscription: 'sub1',
                    metricNamespace: 'ns1',
                    resourceGroup: 'rg2',
                    resourceName: 'res2',
                },
            ] }));
        expect(screen.getByDisplayValue('sub1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('ns1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('rg1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('res1')).toBeInTheDocument();
        expect(screen.getByDisplayValue('rg2')).toBeInTheDocument();
        expect(screen.getByDisplayValue('res2')).toBeInTheDocument();
    }));
});
//# sourceMappingURL=AdvancedResourcePicker.test.js.map