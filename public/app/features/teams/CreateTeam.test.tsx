import React from 'react';
import { shallow } from 'enzyme';
import { CreateTeam, Props } from './CreateTeam';
import { mockActionCreator } from 'app/core/redux';
import { updateLocation } from 'app/core/actions';

describe('Render', () => {
  it('should render component', () => {
    const props: Props = {
      updateLocation: mockActionCreator(updateLocation),
      navModel: {} as any,
    };
    const wrapper = shallow(<CreateTeam {...props} />);

    expect(wrapper).toMatchSnapshot();
  });
});
