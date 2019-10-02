import React from 'react';
import { shallow } from 'enzyme';
import InviteesTable, { Props } from './InviteesTable';
import { Invitee } from 'app/types';
import { getMockInvitees } from './__mocks__/userMocks';

const setup = (propOverrides?: object) => {
  const props: Props = {
    invitees: [] as Invitee[],
  };

  Object.assign(props, propOverrides);

  return shallow(<InviteesTable {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render invitees', () => {
    const wrapper = setup({
      invitees: getMockInvitees(5),
    });

    expect(wrapper).toMatchSnapshot();
  });
});
