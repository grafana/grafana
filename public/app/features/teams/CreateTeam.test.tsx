import { shallow } from 'enzyme';
import React from 'react';

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
