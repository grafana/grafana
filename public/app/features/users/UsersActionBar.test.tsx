import React from 'react';
import { shallow } from 'enzyme';
import { UsersActionBar, Props } from './UsersActionBar';

const setup = (propOverrides?: object) => {
  const props: Props = {
    searchQuery: '',
    setUsersSearchQuery: jest.fn(),
    onShowInvites: jest.fn(),
    pendingInvitesCount: 0,
    canInvite: false,
    externalUserMngLinkUrl: '',
    externalUserMngLinkName: '',
    showInvites: false,
  };

  Object.assign(props, propOverrides);

  return shallow(<UsersActionBar {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render pending invites button', () => {
    const wrapper = setup({
      pendingInvitesCount: 5,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should show invite button', () => {
    const wrapper = setup({
      canInvite: true,
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should show external user management button', () => {
    const wrapper = setup({
      externalUserMngLinkUrl: 'some/url',
    });

    expect(wrapper).toMatchSnapshot();
  });
});
