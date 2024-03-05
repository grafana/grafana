import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { Field } from '@grafana/ui';

import { PasswordField } from './PasswordField';

describe('PasswordField', () => {
  it('should render correctly', () => {
    render(
      <Field label="Password">
        <PasswordField id="password" />
      </Field>
    );

    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Show password' })).toBeInTheDocument();
  });

  it('should able to show password value if clicked on password-reveal icon', () => {
    render(
      <Field label="Password">
        <PasswordField id="password" />
      </Field>
    );

    expect(screen.getByLabelText('Password')).toHaveProperty('type', 'password');
    fireEvent.click(screen.getByRole('switch', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveProperty('type', 'text');
  });
});
