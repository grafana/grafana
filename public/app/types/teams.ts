import { TeamDto as TeamDtoLegacy } from 'app/api/clients/legacy';

import { Role } from './accessControl';

export interface TeamDTO {
  /**
   * Email of the team.
   */
  email?: string;
  /**
   * Name of the team.
   */
  name: string;
}

export type Team = TeamDtoLegacy;

export interface TeamWithRoles extends Team {
  /**
   * RBAC roles assigned to the team.
   */
  roles?: Role[];
}

export interface TeamMember {
  userId: number;
  teamId: number;
  avatarUrl: string;
  email: string;
  name: string;
  login: string;
  labels: string[];
  permission: number;
}

export interface TeamGroup {
  groupId: string;
  teamId: number;
}

export interface TeamState {
  groups: TeamGroup[];
}
