import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamPages } from './TeamPages';
import { OrgRole, Team, TeamMember } from '../../types';
import { getMockTeam } from './__mocks__/teamMocks';
import { User } from 'app/core/services/context_srv';
import { NavModel } from '@grafana/data';

jest.mock('app/core/config', () => ({
  ...((jest.requireActual('app/core/config') as unknown) as object),
  licenseInfo: {
    hasLicense: true,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {} as NavModel,
    teamId: 1,
    loadTeam: jest.fn(),
    loadTeamMembers: jest.fn(),
    pageName: 'members',
    team: {} as Team,
    members: [] as TeamMember[],
    editorsCanAdmin: false,
    signedInUser: {
      id: 1,
      isGrafanaAdmin: false,
      orgRole: OrgRole.Viewer,
    } as User,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamPages {...props} />);
  const instance = wrapper.instance();

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render member page if team not empty', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render settings and preferences page', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
      pageName: 'settings',
      preferences: {
        homeDashboardId: 1,
        theme: 'Default',
        timezone: 'Default',
      },
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render group sync page', () => {
    const { wrapper } = setup({
      team: getMockTeam(),
      pageName: 'groupsync',
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    it('should render settings page if user is team admin', () => {
      const { wrapper } = setup({
        team: getMockTeam(),
        pageName: 'settings',
        preferences: {
          homeDashboardId: 1,
          theme: 'Default',
          timezone: 'Default',
        },
        editorsCanAdmin: true,
        signedInUser: {
          id: 1,
          isGrafanaAdmin: false,
          orgRole: OrgRole.Admin,
        } as User,
      });

      expect(wrapper).toMatchSnapshot();
    });

    it('should not render settings page if user is team member', () => {
      const { wrapper } = setup({
        team: getMockTeam(),
        pageName: 'settings',
        preferences: {
          homeDashboardId: 1,
          theme: 'Default',
          timezone: 'Default',
        },
        editorsCanAdmin: true,
        signedInUser: {
          id: 1,
          isGrafanaAdmin: false,
          orgRole: OrgRole.Viewer,
        } as User,
      });

      expect(wrapper).toMatchSnapshot();
    });
  });
});
