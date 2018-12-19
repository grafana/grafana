import React from 'react';
import { shallow } from 'enzyme';
import UsersTable, { Props } from './UsersTable';
import { OrgUser } from 'app/types';
import { getMockUsers } from './__mocks__/userMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    users: [] as OrgUser[],
    onRoleChange: jest.fn(),
    onRemoveUser: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<UsersTable {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render users table', () => {
    const wrapper = setup({
      users: getMockUsers(5),
    });

    expect(wrapper).toMatchSnapshot();
  });
});
