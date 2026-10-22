import { type Role } from 'app/types/accessControl';

interface RoleGroupOverride {
  prefix: 'fixed' | 'plugins' | 'custom';
  name: string;
}

type RoleGroupResolver = (role: Role) => RoleGroupOverride | undefined;

let roleGroupResolver: RoleGroupResolver | undefined;

export function registerRoleGroupResolver(resolver: RoleGroupResolver) {
  roleGroupResolver = resolver;
}

export function getRoleGroupOverride(role: Role): RoleGroupOverride | undefined {
  return roleGroupResolver?.(role);
}
