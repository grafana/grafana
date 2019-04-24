import React from 'react';
import { shallow } from 'enzyme';
import OrgProfile, { Props } from './OrgProfile';

const setup = () => {
  const props: Props = {
    orgName: 'Main org',
    onSubmit: jest.fn(),
    onOrgNameChange: jest.fn(),
  };

  return shallow(<OrgProfile {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });
});
