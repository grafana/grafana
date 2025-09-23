import { api } from 'app/percona/shared/helpers/api';

import {
  AccessRole,
  AccessRoleResponse,
  AssignRolePayload,
  CreateAccessRole,
  CreateAccessRolePayload,
  DeleteAccessRole,
  GetRoleParams,
  ListRolesResponse,
  SetDefaultRolePayload,
  UpdateAccessRole,
  UpdateAccessRolePayload,
} from './Roles.types';
import { toAccessRole, toCreateBody, toUpdateBody } from './Roles.utils';

const BASE_URL = '/v1/accesscontrol/roles';

const RolesService = {
  async get(roleId: number): Promise<AccessRole> {
    const response = await api.get<AccessRoleResponse, GetRoleParams>(`${BASE_URL}/${roleId}`);
    return toAccessRole(response);
  },
  async list(): Promise<AccessRole[]> {
    const response = await api.get<ListRolesResponse, void>(BASE_URL);
    return response.roles.map((role) => toAccessRole(role));
  },
  async create(role: CreateAccessRole): Promise<void> {
    await api.post<void, CreateAccessRolePayload>(BASE_URL, toCreateBody(role));
  },
  async update(role: UpdateAccessRole): Promise<void> {
    await api.put<void, UpdateAccessRolePayload>(`${BASE_URL}/${role.roleId}`, toUpdateBody(role));
  },
  async delete(role: DeleteAccessRole): Promise<void> {
    await api.delete(`${BASE_URL}/${role.toDeleteId}`, false, undefined, {
      replacement_role_id: role.replacementRoleId,
    });
  },
  async assign(roleIds: number[], userId: number): Promise<void> {
    await api.post<void, AssignRolePayload>(`${BASE_URL}:assign`, {
      role_ids: roleIds,
      user_id: userId,
    });
  },
  async setDefault(roleId: number): Promise<void> {
    await api.post<void, SetDefaultRolePayload>(`${BASE_URL}:setDefault`, {
      role_id: roleId,
    });
  },
};

export default RolesService;
