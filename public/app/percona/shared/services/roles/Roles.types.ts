export interface GetRoleParams {
  role_id: number;
}

export interface AccessRole {
  roleId: number;
  title: string;
  filter: string;
  description?: string;
}

export interface AccessRoleResponse {
  role_id: number;
  title: string;
  filter: string;
}

export interface ListRolesResponse {
  roles: AccessRoleResponse[];
}

export type CreateAccessRole = Omit<AccessRole, 'roleId'>;

export type CreateAccessRolePayload = CreateAccessRole;

export type UpdateAccessRole = AccessRole;

export type UpdateAccessRolePayload = Omit<UpdateAccessRole, 'roleId'> & {
  role_id: number;
};

export interface DeleteAccessRolePayload {
  role_id: number;
  replacement_role_id: number;
}

export interface AssignRolePayload {
  role_ids: number[];
  user_id: number;
}

export interface SetDefaultRolePayload {
  role_id: number;
}

export interface DeleteAccessRole {
  toDeleteId: number;
  replacementRoleId: number;
}
