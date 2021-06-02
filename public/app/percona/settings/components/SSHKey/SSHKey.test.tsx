import React from 'react';
import { mount } from 'enzyme';
import { SSHKey } from './SSHKey';

describe('SSHKey::', () => {
  it('Renders correctly with props', () => {
    const root = mount(<SSHKey sshKey="test key" updateSettings={() => {}} />);

    expect(root.find('textarea').text()).toEqual('test key');
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(<SSHKey sshKey="test key" updateSettings={() => {}} />);
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    const root = mount(<SSHKey sshKey="test key" updateSettings={updateSettings} />);

    root.find('textarea').simulate('change', { target: { value: 'new key' } });
    root.find('form').simulate('submit');

    expect(updateSettings).toHaveBeenCalled();
  });
});
