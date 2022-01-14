import React from 'react';
import { mount } from 'enzyme';
import { DBClusterConnectionPassword } from './DBClusterConnectionPassword';
import { HIDDEN_PASSWORD_LENGTH } from './DBClusterConnectionPassword.constants';

describe('DBClusterConnectionPassword::', () => {
  it('renders correctly', () => {
    const root = mount(<DBClusterConnectionPassword label="Test" password="1234" />);

    expect(root.find('div').at(0).children().length).toBe(2);
    expect(root.text()).toContain('Test');
    expect(root.text()).toContain('*'.repeat(HIDDEN_PASSWORD_LENGTH));
  });
  it('should show/hide password', () => {
    const root = mount(<DBClusterConnectionPassword label="test label" password="1234" />);
    const button = root.find('[data-testid="show-password-button"]').find('button');

    expect(root.text()).toContain('*'.repeat(HIDDEN_PASSWORD_LENGTH));

    button.simulate('click');

    expect(root.text()).toContain('1234');
  });
});
