import { render, screen } from '@testing-library/react';
import React from 'react';
import { ProgressBar } from './ProgressBar';
import { ProgressBarStatus } from './ProgressBar.types';
describe('ProgressBar::', () => {
    it('renders with steps, message and width', () => {
        render(React.createElement(ProgressBar, { finishedSteps: 5, totalSteps: 10, status: ProgressBarStatus.progress, message: "test message" }));
        expect(screen.getByTestId('progress-bar-steps')).toHaveTextContent('5/10');
        expect(screen.getByTestId('progress-bar-message')).toHaveTextContent('test message');
        expect(screen.getByTestId('progress-bar-content').className).not.toContain('error');
        expect(getComputedStyle(screen.getByTestId('progress-bar-content').children[0]).width).toEqual('50%');
    });
    it('renders without message and rounds float width to nearest integer', () => {
        render(React.createElement(ProgressBar, { finishedSteps: 4, totalSteps: 7, status: ProgressBarStatus.progress }));
        expect(screen.getByTestId('progress-bar-steps')).toHaveTextContent('4/7');
        expect(screen.getByTestId('progress-bar-message')).toHaveTextContent('');
        expect(getComputedStyle(screen.getByTestId('progress-bar-content').children[0]).width).toEqual('57%');
    });
    it('renders with error status', () => {
        render(React.createElement(ProgressBar, { finishedSteps: 0, totalSteps: 1, message: "test message", status: ProgressBarStatus.error }));
        expect(screen.getByTestId('progress-bar-steps')).toHaveTextContent('0/1');
        expect(screen.getByTestId('progress-bar-message')).toHaveTextContent('test message');
        expect(getComputedStyle(screen.getByTestId('progress-bar-content').children[0]).width).toEqual('0%');
        expect(screen.getByTestId('progress-bar-content').children[0].className).toContain('error');
    });
    it('handles invalid total steps', () => {
        render(React.createElement(ProgressBar, { finishedSteps: 5, totalSteps: 0, status: ProgressBarStatus.progress }));
        expect(getComputedStyle(screen.getByTestId('progress-bar-content').children[0]).width).toEqual('0%');
    });
});
//# sourceMappingURL=ProgressBar.test.js.map