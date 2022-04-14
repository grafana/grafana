import React from 'react';
import { Form } from 'react-final-form';
import { PostgreSQLConnectionDetails } from './PostgreSQLConnectionDetails';
import { render, screen, fireEvent } from '@testing-library/react';

describe('PostgreSQL connection details:: ', () => {
  it('should have database attribute', () => {
    render(<Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />);

    const textInput = screen.getByTestId('database-text-input');
    fireEvent.change(textInput, { target: { value: 'db1' } });

    expect(screen.getByTestId('database-text-input')).toHaveValue('db1');
  });
});
