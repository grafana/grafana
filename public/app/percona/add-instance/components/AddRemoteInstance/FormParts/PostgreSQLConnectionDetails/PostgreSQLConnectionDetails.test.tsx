import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { PostgreSQLConnectionDetails } from './PostgreSQLConnectionDetails';

jest.mock('app/percona/inventory/Inventory.service');

describe('PostgreSQL connection details:: ', () => {
  it('should have database attribute', async () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const textInput = screen.getByTestId('database-text-input');
    fireEvent.change(textInput, { target: { value: 'db1' } });

    await waitFor(() => expect(screen.getByTestId('database-text-input')).toHaveValue('db1'));
  });

  it('should have max query length attribute', async () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const textInput = screen.getByTestId('maxQueryLength-text-input');
    fireEvent.change(textInput, { target: { value: '1000' } });

    await waitFor(() => expect(screen.getByTestId('maxQueryLength-text-input')).toHaveValue('1000'));
  });
});
