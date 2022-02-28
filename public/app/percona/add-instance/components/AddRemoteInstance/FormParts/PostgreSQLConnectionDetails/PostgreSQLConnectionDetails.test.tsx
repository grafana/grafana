import { mount } from 'enzyme';
import React from 'react';
import { Form } from 'react-final-form';
import { dataTestId } from '@percona/platform-core';
import { PostgreSQLConnectionDetails } from './PostgreSQLConnectionDetails';

describe('PostgreSQL connection details:: ', () => {
  it('should have database attribute', () => {
    const root = mount(
      <Form onSubmit={jest.fn()} render={() => <PostgreSQLConnectionDetails remoteInstanceCredentials={{}} />} />
    );

    root.find(dataTestId('database-text-input')).simulate('change', { target: { value: 'db1' } });

    expect(root.find(dataTestId('database-text-input')).props().value).toEqual('db1');
  });
});
