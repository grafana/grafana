import { render, screen } from '@testing-library/react';
import React from 'react';

import { Alert } from './Alert';

describe('Alert', () => {
  it('sets the accessible label correctly based on the title if there is no aria-label set', () => {
    render(<Alert title="Uh oh spagghettios!" />);
    expect(screen.getByRole('alert', { name: 'Uh oh spagghettios!' })).toBeInTheDocument();
  });

  it('prefers the aria-label attribute over the title if it is set', () => {
    render(<Alert title="Uh oh spagghettios!" aria-label="A fancy label" />);
    expect(screen.queryByRole('alert', { name: 'Uh oh spagghettios!' })).not.toBeInTheDocument();
    expect(screen.getByRole('alert', { name: 'A fancy label' })).toBeInTheDocument();
  });

  it('infers the role based on the severity in case it is not set manually', () => {
    render(<Alert title="Error message" severity="error" />);
    expect(screen.getByRole('alert', { name: 'Error message' })).toBeInTheDocument();

    render(<Alert title="Warning message" severity="warning" />);
    expect(screen.getByRole('alert', { name: 'Warning message' })).toBeInTheDocument();

    render(<Alert title="Success message" severity="success" />);
    expect(screen.getByRole('status', { name: 'Success message' })).toBeInTheDocument();

    render(<Alert title="Info message" severity="info" />);
    expect(screen.getByRole('status', { name: 'Info message' })).toBeInTheDocument();
  });

  it('is possible to set the role manually', () => {
    render(<Alert title="Error message" severity="error" role="status" />);
    expect(screen.queryByRole('alert', { name: 'Error message' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Error message' })).toBeInTheDocument();
  });
});
