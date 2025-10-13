import {
  AccessRole,
  AccessRoleResponse,
  CreateAccessRole,
  CreateAccessRolePayload,
  UpdateAccessRole,
  UpdateAccessRolePayload,
} from './Roles.types';

export const toAccessRole = (response: AccessRoleResponse): AccessRole => ({
  ...response,
  roleId: response.role_id,
});

export const toUpdateBody = (payload: UpdateAccessRole): UpdateAccessRolePayload => ({
  role_id: payload.roleId,
  description: payload.description,
  filter: payload.filter,
  title: payload.title,
});

export const toCreateBody = (payload: CreateAccessRole): CreateAccessRolePayload => ({
  ...payload,
});
