import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { Email } from './Email';

describe('Email::', () => {
  it('Renders with props', () => {
    const root = mount(
      <Email
        settings={{
          username: 'test',
        }}
        updateSettings={() => {}}
      />
    );

    expect(root.find(dataQa('username-text-input')).prop('value')).toEqual('test');
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(
      <Email
        settings={{
          username: 'test',
        }}
        updateSettings={() => {}}
      />
    );
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });
});
