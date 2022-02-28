import React from 'react';
import { Form } from 'react-final-form';
import { fireEvent, render, screen } from '@testing-library/react';
import { HAProxyConnectionDetails } from './HAProxyConnectionDetails';

describe('HAProxy connection details:: ', () => {
  it('should trim username and password values right', () => {
    render(<Form onSubmit={jest.fn()} render={() => <HAProxyConnectionDetails remoteInstanceCredentials={{}} />} />);

    const userNameTextInput = screen.getByTestId('username-text-input');
    fireEvent.change(userNameTextInput, { target: { value: '    test     ' } });
    const passwordInput = screen.getByTestId('password-password-input');
    fireEvent.change(passwordInput, { target: { value: '    test    ' } });

    expect(screen.getByTestId('username-text-input') as HTMLInputElement).toHaveValue('test');
    expect(screen.getByTestId('password-password-input') as HTMLInputElement).toHaveValue('test');
  });
});
