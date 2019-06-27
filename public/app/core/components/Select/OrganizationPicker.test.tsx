import React from 'react';
import { shallow } from 'enzyme';
import { OrganizationPicker, Props } from './OrganizationPicker';

const setup = () => {
  const props: Props = {
    onSelected: () => {},
  };

  return shallow(<OrganizationPicker {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
