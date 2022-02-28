import React from 'react';
import { render, screen } from '@testing-library/react';
import { Platform } from './Platform';

describe('Platform::', () => {
  it('shows form to connect if not connected', () => {
    render(<Platform isConnected={false} getSettings={jest.fn()} />);

    expect(screen.getByTestId('connect-form')).toBeInTheDocument();
  });

  it('shows connected message if connected', () => {
    render(<Platform isConnected getSettings={jest.fn()} />);

    expect(screen.getByTestId('connected-wrapper')).toBeInTheDocument();
  });
});
