import { render, screen } from '@testing-library/react';
import React from 'react';

import { ProgressModalHeader } from './ProgressModalHeader';
import { Messages } from './ProgressModalHeader.messages';

describe('ProgressModalHeader::', () => {
  it('should show that the upgrade is in progress by default', () => {
    render(<ProgressModalHeader />);

    expect(screen.getByText(Messages.updateInProgress)).toBeInTheDocument();
  });

  it('should show that the upgrade succeeded if isUpdated is true', () => {
    render(<ProgressModalHeader isUpdated />);

    expect(screen.getByText(Messages.updateSucceeded)).toBeInTheDocument();
  });

  it('should show ignore updateFailed if isUpdated is true', () => {
    render(<ProgressModalHeader isUpdated updateFailed />);

    expect(screen.getByText(Messages.updateSucceeded)).toBeInTheDocument();
  });

  it('should show the passed error message if the upgrade failed', () => {
    const errorMessage = 'Test Error';
    render(<ProgressModalHeader updateFailed errorMessage={errorMessage} />);

    expect(screen.getByText(Messages.updateFailed)).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });
});
