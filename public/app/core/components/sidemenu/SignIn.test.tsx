import React from 'react';
import { shallow } from 'enzyme';
import { SignIn, SignInPageProps } from './SignIn';
import { updateLocation } from 'app/core/actions';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

const setup = (propOverrides?: object) => {
  const props: SignInPageProps = {
    url: '/',
    updateLocation: mockToolkitActionCreator(updateLocation),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<SignIn {...props} />);

  return {
    wrapper,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
