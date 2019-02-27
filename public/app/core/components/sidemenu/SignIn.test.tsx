import React from 'react';
import { shallow } from 'enzyme';
import SignIn from './SignIn';

describe('Render', () => {
  it('should render component', () => {
    const wrapper = shallow(<SignIn />);

    expect(wrapper).toMatchSnapshot();
  });
});
