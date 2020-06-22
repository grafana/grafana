import React from 'react';
import { shallow } from 'enzyme';
import { SignIn } from './SignIn';

jest.mock('../../config', () => ({
  appUrl: 'http://localhost:3000/',
}));

describe('Render', () => {
  it('should render component', () => {
    const wrapper = shallow(<SignIn url="/" />);

    expect(wrapper).toMatchSnapshot();
  });
});
