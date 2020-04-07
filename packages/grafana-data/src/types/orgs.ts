export interface UserOrgDTO {
  orgId: number;
  name: string;
  role: OrgRole;
}

export enum OrgRole {
  Admin = 'Admin',
  Editor = 'Editor',
  Viewer = 'Viewer',
}
