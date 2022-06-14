import { shallow } from 'enzyme';
import React from 'react';

import BasicSettings, { Props } from './BasicSettings';

const setup = () => {
  const props: Props = {
    dataSource: {
      id: 1,
      name: 'Name',
      uid: 'asd',
    } as any,
    onDefaultChange: jest.fn(),
    onNameChange: jest.fn(),
  };

  return shallow(<BasicSettings {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
