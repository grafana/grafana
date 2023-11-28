import { screen, render } from '@testing-library/react';
import React from 'react';
import { ExpressionStatusIndicator } from './ExpressionStatusIndicator';
describe('ExpressionStatusIndicator', () => {
    it('should render two elements when error and not condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: false, warning: new Error('this is a warning') }));
        expect(screen.getByText('Warning')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Set as alert condition' })).toBeInTheDocument();
    });
    it('should render one element when warning and condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: true, warning: new Error('this is a warning') }));
        expect(screen.getByText('Alert condition')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Set as alert condition' })).not.toBeInTheDocument();
    });
    it('should render two elements when error and not condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: false, error: new Error('this is a error') }));
        expect(screen.getByText('Error')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Set as alert condition' })).toBeInTheDocument();
    });
    it('should render one element when error and condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: true, error: new Error('this is a error') }));
        expect(screen.getByText('Alert condition')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Set as alert condition' })).not.toBeInTheDocument();
    });
    it('should render one element if condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: true }));
        expect(screen.queryByText('Error')).not.toBeInTheDocument();
        expect(screen.queryByText('Warning')).not.toBeInTheDocument();
        expect(screen.getByText('Alert condition')).toBeInTheDocument();
    });
    it('should render one element if not condition', () => {
        render(React.createElement(ExpressionStatusIndicator, { isCondition: false }));
        expect(screen.queryByText('Error')).not.toBeInTheDocument();
        expect(screen.queryByText('Warning')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Alert condition' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Set as alert condition' })).toBeInTheDocument();
    });
});
//# sourceMappingURL=ExpressionStatusIndicator.test.js.map