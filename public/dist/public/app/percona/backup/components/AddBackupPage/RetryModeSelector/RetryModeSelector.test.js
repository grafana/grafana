import { render, screen } from '@testing-library/react';
import React from 'react';
import { RetryMode } from 'app/percona/backup/Backup.types';
import { FormWrapper } from 'app/percona/shared/helpers/utils';
import { RetryModeSelector } from './RetryModeSelector';
describe('RetryModeSelector', () => {
    it('should render', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(RetryModeSelector, { retryMode: RetryMode.AUTO })));
        expect(screen.getAllByTestId('retryMode-radio-state')).toHaveLength(1);
        expect(screen.getAllByTestId('retryTimes-field-container')).toHaveLength(1);
        expect(screen.getAllByTestId('retryInterval-field-container')).toHaveLength(1);
        expect(screen.getByTestId('retryTimes-number-input')).toHaveProperty('disabled', false);
    });
    it('should disable number inputs when retry mode is MANUAL', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(RetryModeSelector, { retryMode: RetryMode.MANUAL })));
        expect(screen.getByTestId('retryTimes-number-input')).toBeDisabled();
    });
    it('should disable all fields when disabled is passed, even if retry mode is AUTO', () => {
        render(React.createElement(FormWrapper, null,
            React.createElement(RetryModeSelector, { disabled: true, retryMode: RetryMode.AUTO })));
        expect(screen.getByTestId('retryTimes-number-input')).toBeDisabled();
        expect(screen.getAllByTestId('retryMode-radio-button')[0]).toBeDisabled();
    });
});
//# sourceMappingURL=RetryModeSelector.test.js.map