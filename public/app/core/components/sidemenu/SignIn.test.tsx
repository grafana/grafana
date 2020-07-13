import React from 'react';
import { shallow } from 'enzyme';
import { SignIn } from './SignIn';

jest.mock('../../config', () => {
  const original = jest.requireActual('../../config');
  const config = original.getConfig();
  return {
    getConfig: () => ({
      ...config,
      appUrl: 'http://localhost:3000/grafana',
      appSubUrl: '/grafana',
    }),
  };
});

describe('Render', () => {
  it('should render component', () => {
    const wrapper = shallow(<SignIn url="/whatever" />);

    expect(wrapper).toMatchSnapshot();
  });
});
