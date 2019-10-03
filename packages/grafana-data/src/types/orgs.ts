export interface UserOrgDTO {
  orgId: number;
  name: string;
  role: Role;
}

export enum Role {
  Admin = 'Admin',
  Editor = 'Editor',
  Viewer = 'Viewer',
}
