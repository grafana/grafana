import { FormWrapper } from '@percona/platform-core';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { RetryMode } from 'app/percona/backup/Backup.types';

import { RetryModeSelector } from './RetryModeSelector';

describe('RetryModeSelector', () => {
  it('should render', () => {
    render(
      <FormWrapper>
        <RetryModeSelector retryMode={RetryMode.AUTO} />
      </FormWrapper>
    );
    expect(screen.getAllByTestId('retryMode-radio-state')).toHaveLength(1);
    expect(screen.getAllByTestId('retryTimes-field-container')).toHaveLength(1);
    expect(screen.getAllByTestId('retryInterval-field-container')).toHaveLength(1);
    expect(screen.getByTestId('retryTimes-number-input')).toHaveProperty('disabled', false);
  });

  it('should disable number inputs when retry mode is MANUAL', () => {
    render(
      <FormWrapper>
        <RetryModeSelector retryMode={RetryMode.MANUAL} />
      </FormWrapper>
    );
    expect(screen.getByTestId('retryTimes-number-input')).toBeDisabled();
  });

  it('should disable all fields when disabled is passed, even if retry mode is AUTO', () => {
    render(
      <FormWrapper>
        <RetryModeSelector disabled retryMode={RetryMode.AUTO} />
      </FormWrapper>
    );
    expect(screen.getByTestId('retryTimes-number-input')).toBeDisabled();
    expect(screen.getAllByTestId('retryMode-radio-button')[0]).toBeDisabled();
  });
});
