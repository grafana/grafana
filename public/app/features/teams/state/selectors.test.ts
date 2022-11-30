import { User } from 'app/core/services/context_srv';

import { Team, TeamGroup, TeamState, OrgRole } from '../../../types';
import { getMockTeam, getMockTeamMembers } from '../__mocks__/teamMocks';

import { getTeam, getTeamMembers, isSignedInUserTeamAdmin, Config } from './selectors';

describe('Team selectors', () => {
  describe('Get team', () => {
    const mockTeam = getMockTeam();

    it('should return team if matching with location team', () => {
      const mockState: TeamState = {
        team: mockTeam,
        searchMemberQuery: '',
        members: [],
        groups: [],
      };

      const team = getTeam(mockState, '1');
      expect(team).toEqual(mockTeam);
    });
  });

  describe('Get members', () => {
    const mockTeamMembers = getMockTeamMembers(5, 5);

    it('should return team members', () => {
      const mockState: TeamState = {
        team: {} as Team,
        searchMemberQuery: '',
        members: mockTeamMembers,
        groups: [] as TeamGroup[],
      };

      const members = getTeamMembers(mockState);
      expect(members).toEqual(mockTeamMembers);
    });
  });
});

const signedInUserId = 1;

const setup = (configOverrides?: Partial<Config>) => {
  const defaultConfig: Config = {
    editorsCanAdmin: false,
    members: getMockTeamMembers(5, 5),
    signedInUser: {
      id: signedInUserId,
      isGrafanaAdmin: false,
      orgRole: OrgRole.Viewer,
    } as User,
  };

  return { ...defaultConfig, ...configOverrides };
};

describe('isSignedInUserTeamAdmin', () => {
  describe('when feature toggle editorsCanAdmin is turned off', () => {
    it('should return true', () => {
      const config = setup();

      const result = isSignedInUserTeamAdmin(config);

      expect(result).toBe(true);
    });
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    it('should return true if signed in user is grafanaAdmin', () => {
      const config = setup({
        editorsCanAdmin: true,
        signedInUser: {
          id: signedInUserId,
          isGrafanaAdmin: true,
          orgRole: OrgRole.Viewer,
        } as User,
      });

      const result = isSignedInUserTeamAdmin(config);

      expect(result).toBe(true);
    });

    it('should return true if signed in user is org admin', () => {
      const config = setup({
        editorsCanAdmin: true,
        signedInUser: {
          id: signedInUserId,
          isGrafanaAdmin: false,
          orgRole: OrgRole.Admin,
        } as User,
      });

      const result = isSignedInUserTeamAdmin(config);

      expect(result).toBe(true);
    });

    it('should return true if signed in user is team admin', () => {
      const config = setup({
        members: getMockTeamMembers(5, signedInUserId),
        editorsCanAdmin: true,
        signedInUser: {
          id: signedInUserId,
          isGrafanaAdmin: false,
          orgRole: OrgRole.Viewer,
        } as User,
      });

      const result = isSignedInUserTeamAdmin(config);

      expect(result).toBe(true);
    });

    it('should return false if signed in user is not grafanaAdmin, org admin or team admin', () => {
      const config = setup({
        editorsCanAdmin: true,
        signedInUser: {
          id: signedInUserId,
          isGrafanaAdmin: false,
          orgRole: OrgRole.Viewer,
        } as User,
      });

      const result = isSignedInUserTeamAdmin(config);

      expect(result).toBe(false);
    });
  });
});
