import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { Slack } from './Slack';

describe('Slack::', () => {
  it('Renders with props', () => {
    const root = mount(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={() => {}}
      />
    );

    expect(root.find(dataQa('url-text-input')).prop('value')).toEqual('test');
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={() => {}}
      />
    );
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    const root = mount(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={updateSettings}
      />
    );

    root.find(dataQa('url-text-input')).simulate('change', { target: { value: 'new key' } });
    root.find('form').simulate('submit');

    expect(updateSettings).toHaveBeenCalled();
  });
});
