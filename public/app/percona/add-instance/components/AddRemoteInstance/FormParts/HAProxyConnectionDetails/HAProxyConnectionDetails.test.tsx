import { mount } from 'enzyme';
import React from 'react';
import { Form } from 'react-final-form';
import { dataQa } from '@percona/platform-core';
import { HAProxyConnectionDetails } from './HAProxyConnectionDetails';

xdescribe('HAProxy connection details:: ', () => {
  it('should trim username and password values right', async () => {
    const root = mount(
      <Form onSubmit={jest.fn()} render={() => <HAProxyConnectionDetails remoteInstanceCredentials={{}} />} />
    );

    root.find(dataQa('username-text-input')).simulate('change', { target: { value: '    test    ' } });
    root.find(dataQa('password-password-input')).simulate('change', { target: { value: '    test    ' } });

    expect(root.find(dataQa('username-text-input')).props().value).toEqual('test');
    expect(root.find(dataQa('password-password-input')).props().value).toEqual('test');
  });
});
