import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { HAProxyConnectionDetails } from './HAProxyConnectionDetails';

describe('HAProxy connection details:: ', () => {
  it('should trim username and password values right', () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <HAProxyConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const userNameTextInput = screen.getByTestId('username-text-input');
    fireEvent.change(userNameTextInput, { target: { value: '    test     ' } });
    const passwordInput = screen.getByTestId('password-password-input');
    fireEvent.change(passwordInput, { target: { value: '    test    ' } });

    expect(screen.getByTestId('username-text-input') as HTMLInputElement).toHaveValue('test');
    expect(screen.getByTestId('password-password-input') as HTMLInputElement).toHaveValue('test');
  });
});
