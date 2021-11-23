import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { Email } from './Email';

xdescribe('Email::', () => {
  it('Renders with props', () => {
    const root = mount(
      <Email
        settings={{
          username: 'test',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          require_tls: false,
        }}
        updateSettings={() => {}}
      />
    );

    expect(root.find(dataTestId('username-text-input')).prop('value')).toEqual('test');
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(
      <Email
        settings={{
          username: 'test',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          require_tls: false,
        }}
        updateSettings={() => {}}
      />
    );
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('Disables username and password when NONE is selected', () => {
    const root = mount(
      <Email
        settings={{
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          require_tls: false,
        }}
        updateSettings={() => {}}
      />
    );

    expect(root.find(dataTestId('username-text-input')).prop('disabled')).toBeTruthy();
    expect(root.find(dataTestId('password-password-input')).prop('disabled')).toBeTruthy();
  });

  it('Enabled username and password when NONE is not selected', () => {
    const root = mount(
      <Email
        settings={{
          username: 'user',
          password: 'pass',
          from: 'from@mail.com',
          smarthost: 'host.com',
          hello: 'hello',
          require_tls: false,
        }}
        updateSettings={() => {}}
      />
    );

    expect(root.find(dataTestId('username-text-input')).prop('disabled')).toBeFalsy();
    expect(root.find(dataTestId('password-password-input')).prop('disabled')).toBeFalsy();
  });
});
