import { shallow } from 'enzyme';
import React from 'react';

import { Invitee } from 'app/types';

import { getMockInvitees } from '../users/__mocks__/userMocks';

import InviteesTable, { Props } from './InviteesTable';

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
