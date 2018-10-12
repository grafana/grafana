import React from 'react';
import { shallow } from 'enzyme';
import { AddDataSourcePermissions, Props } from './AddDataSourcePermissions';
import { AclTarget } from '../../types/acl';

const setup = () => {
  const props: Props = {
    onAddPermission: jest.fn(),
    onCancel: jest.fn(),
  };

  return shallow(<AddDataSourcePermissions {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render user picker', () => {
    const wrapper = setup();

    wrapper.instance().setState({ type: AclTarget.User });

    expect(wrapper).toMatchSnapshot();
  });
});
