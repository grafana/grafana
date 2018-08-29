import React from 'react';
import { shallow } from 'enzyme';
import DropDownChild from './DropDownChild';

const setup = (propOverrides?: object) => {
  const props = Object.assign({}, propOverrides);

  return shallow(<DropDownChild {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
