import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Form } from 'react-final-form';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';

import { MySQLConnectionDetails } from './MySQLConnectionDetails';

describe('MySQL connection details:: ', () => {
  it('should have max query length attribute', () => {
    render(
      <Provider store={configureStore()}>
        <Form onSubmit={jest.fn()} render={() => <MySQLConnectionDetails remoteInstanceCredentials={{}} />} />
      </Provider>
    );

    const textInput = screen.getByTestId('maxQueryLength-text-input');
    fireEvent.change(textInput, { target: { value: '1000' } });

    expect(screen.getByTestId('maxQueryLength-text-input')).toHaveValue('1000');
  });
});
