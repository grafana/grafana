/**
 * Permissions are stored in the backend as a map of key value pairs
 * where the key is the permission and the value is a boolean
 *
 * Schema:
 * `resource:action => true/false`
 *
 * Example:
 * `dashboard:edit => true`
 * */
export type Permission = {
  name: string;
  group: string;
  displayName: string;
  status: boolean;
  description: string;
  isDefault: boolean;
};

export type PermissionGroup = {
  [group: string]: Permission[];
};
