import React from 'react';
import { render, screen } from '@testing-library/react';
import { Connect } from './Connect';

jest.mock('../Platform.service.ts');

describe('Connect::', () => {
  it('renders Connect form correctly', () => {
    render(<Connect getSettings={jest.fn()} />);

    expect(screen.getByTestId('pmmServerName-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('email-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('password-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('connect-button')).toBeInTheDocument();
  });
});
