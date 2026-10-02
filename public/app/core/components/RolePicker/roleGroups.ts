import { type AppPluginConfig } from '@grafana/data';
import { type Role } from 'app/types/accessControl';

export enum GroupType {
  fixed = 'fixed',
  custom = 'custom',
  plugin = 'plugin',
}

type RoleGroupingApp = Pick<AppPluginConfig, 'id' | 'name' | 'appPlatformRoleGroup'>;

export function getRolePickerGroup(role: Role, apps: RoleGroupingApp[] = []) {
  const prefix = role.name.split(':')[0];
  const type = prefix === 'fixed' ? GroupType.fixed : prefix === 'plugins' ? GroupType.plugin : GroupType.custom;
  const name = role.group || 'Other';
  const matchingApps = apps.filter(
    (app) =>
      app.appPlatformRoleGroup &&
      app.name &&
      (role.name.startsWith(`fixed:${app.appPlatformRoleGroup}:`) || role.name.startsWith(`plugins:${app.id}:`))
  );

  // Conflicting app claims must not make grouping depend on metadata order.
  const [app] = matchingApps;
  if (matchingApps.length === 1 && app.name) {
    return { type: GroupType.plugin, value: `app:${app.id}`, name: app.name };
  }

  return { type, value: `${role.name.includes(':') ? prefix : 'unknown'}:${name}`, name };
}
