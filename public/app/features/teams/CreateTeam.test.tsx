import React from 'react';
import { shallow } from 'enzyme';
import { CreateTeam, Props } from './CreateTeam';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { updateLocation } from 'app/core/actions';

describe('Render', () => {
  it('should render component', () => {
    const props: Props = {
      updateLocation: mockToolkitActionCreator(updateLocation),
      navModel: {} as any,
    };
    const wrapper = shallow(<CreateTeam {...props} />);

    expect(wrapper).toMatchSnapshot();
  });
});
