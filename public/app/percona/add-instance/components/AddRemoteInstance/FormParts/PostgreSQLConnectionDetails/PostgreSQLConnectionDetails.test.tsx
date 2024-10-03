import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { PostgreSQLConnectionDetails } from './PostgreSQLConnectionDetails';

describe('PostgreSQL connection details:: ', () => {
  it('should have database attribute', () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const textInput = screen.getByTestId('database-text-input');
    fireEvent.change(textInput, { target: { value: 'db1' } });

    expect(screen.getByTestId('database-text-input')).toHaveValue('db1');
  });

  it('should have max query length attribute', () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const textInput = screen.getByTestId('maxQueryLength-text-input');
    fireEvent.change(textInput, { target: { value: '1000' } });

    expect(screen.getByTestId('maxQueryLength-text-input')).toHaveValue('1000');
  });
});
