import React from 'react';
import { shallow } from 'enzyme';
import { CreateTeam, Props } from './CreateTeam';

describe('Render', () => {
  it('should render component', () => {
    const props: Props = {
      navModel: {} as any,
    };
    const wrapper = shallow(<CreateTeam {...props} />);

    expect(wrapper).toMatchSnapshot();
  });
});
