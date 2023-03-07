import { api } from 'app/percona/shared/helpers/api';

import {
  AccessRole,
  AccessRoleResponse,
  AssignRolePayload,
  CreateAccessRole,
  CreateAccessRolePayload,
  DeleteAccessRole,
  DeleteAccessRolePayload,
  GetRoleParams,
  ListRolesResponse,
  SetDefaultRolePayload,
  UpdateAccessRole,
  UpdateAccessRolePayload,
} from './Roles.types';
import { toAccessRole, toCreateBody, toUpdateBody } from './Roles.utils';

const BASE_URL = '/v1/management/Role';

const RolesService = {
  async get(roleId: number): Promise<AccessRole> {
    const response = await api.post<AccessRoleResponse, GetRoleParams>(`${BASE_URL}/Get`, { role_id: roleId });
    return toAccessRole(response);
  },
  async list(): Promise<AccessRole[]> {
    const response = await api.post<ListRolesResponse, void>(`${BASE_URL}/List`, undefined);
    return response.roles.map((role) => toAccessRole(role));
  },
  async create(role: CreateAccessRole): Promise<void> {
    await api.post<void, CreateAccessRolePayload>(`${BASE_URL}/Create`, toCreateBody(role));
  },
  async update(role: UpdateAccessRole): Promise<void> {
    await api.post<void, UpdateAccessRolePayload>(`${BASE_URL}/Update`, toUpdateBody(role));
  },
  async delete(role: DeleteAccessRole): Promise<void> {
    await api.post<void, DeleteAccessRolePayload>(`${BASE_URL}/Delete`, {
      role_id: role.toDeleteId,
      replacement_role_id: role.replacementRoleId,
    });
  },
  async assign(roleIds: number[], userId: number): Promise<void> {
    await api.post<void, AssignRolePayload>(`${BASE_URL}/Assign`, {
      role_ids: roleIds,
      user_id: userId,
    });
  },
  async setDefault(roleId: number): Promise<void> {
    await api.post<void, SetDefaultRolePayload>(`${BASE_URL}/SetDefault`, {
      role_id: roleId,
    });
  },
};

export default RolesService;
