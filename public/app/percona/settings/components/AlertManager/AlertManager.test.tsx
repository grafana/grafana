import React from 'react';
import { mount } from 'enzyme';
import { AlertManager } from './AlertManager';

describe('AlertManager::', () => {
  it('Renders correctly with props', () => {
    const root = mount(
      <AlertManager alertManagerUrl="test url" alertManagerRules="test rules" updateSettings={() => {}} />
    );

    expect(
      root
        .find('[data-qa="alertmanager-url"]')
        .find('input')
        .prop('value')
    ).toEqual('test url');
    expect(root.find('textarea').text()).toEqual('test rules');
  });

  it('Disables apply changes on initial values', () => {
    const root = mount(<AlertManager alertManagerUrl="" alertManagerRules="" updateSettings={() => {}} />);
    const button = root.find('button');

    expect(button.prop('disabled')).toBeTruthy();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    const root = mount(
      <AlertManager alertManagerUrl="test url" alertManagerRules="test rules" updateSettings={updateSettings} />
    );

    root.find('textarea').simulate('change', { target: { value: 'new key' } });
    root.find('form').simulate('submit');

    expect(updateSettings).toHaveBeenCalled();
  });
});
