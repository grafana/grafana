import React from 'react';
import { mount } from 'enzyme';
import { AddClusterButton } from './AddClusterButton';

describe('AddClusterButton::', () => {
  it('renders correctly and calls action', () => {
    const action = jest.fn();
    const root = mount(<AddClusterButton label="test" action={action} />);
    const button = root.find('button');

    button.simulate('click');

    expect(button.text()).toEqual('test');
    expect(action).toHaveBeenCalled();
  });

  it('disables button correctly', () => {
    const action = jest.fn();
    const root = mount(<AddClusterButton label="test" action={action} disabled />);
    const button = root.find('button');

    button.simulate('click');

    expect(action).not.toHaveBeenCalled();
    expect(button.prop('disabled')).toBeTruthy();
  });
});
