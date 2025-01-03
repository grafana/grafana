import { WithAccessControlMetadata } from './accesscontrol';

export interface Team extends WithAccessControlMetadata {
  /**
   * Internal id of team
   * @deprecated use uid instead
   */
  id: number;
  /**
   * A unique identifier for the team.
   */
  uid: string; // Prefer UUID
  /**
   * AvatarUrl is the team's avatar URL.
   */
  avatarUrl?: string;
  /**
   * Email of the team.
   */
  email?: string;
  /**
   * MemberCount is the number of the team members.
   */
  memberCount: number;
  /**
   * Name of the team.
   */
  name: string;
  /**
   * OrgId is the ID of an organisation the team belongs to.
   */
  orgId: number;
}
