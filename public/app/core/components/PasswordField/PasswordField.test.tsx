import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  const props = {
    id: 'password',
    placeholder: 'enter password',
    'data-testid': 'password-field',
  };
  it('should renders correctly', () => {
    render(<PasswordField {...props} />);
    expect(screen.getByTestId('password-field')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
  it('should able to show password value if clicked on password-reveal icon', () => {
    render(<PasswordField {...props} />);
    expect(screen.getByTestId('password-field')).toHaveProperty('type', 'password');
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('password-field')).toHaveProperty('type', 'text');
  });
});
