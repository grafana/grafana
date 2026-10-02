import { type Role } from 'app/types/accessControl';

import { getRolePickerGroup } from './roleGroups';

const app = {
  id: 'example-plugin-app',
  name: 'Example Plugin',
  appPlatformRoleGroup: 'plugin.ext.grafana.app',
};
const resourceRole: Role = {
  name: 'fixed:plugin.ext.grafana.app:plugin:resources-reader',
  uid: 'resources-reader',
  group: 'Plugin',
  version: 1,
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
  description: '',
  displayName: 'Resources Reader',
  filteredDisplayName: 'Plugin:Resources Reader',
};

it.each([undefined, '', 'other.ext.grafana.app'])('keeps existing grouping without a matching opt-in (%s)', (group) => {
  expect(getRolePickerGroup(resourceRole, [{ ...app, appPlatformRoleGroup: group }])).toEqual({
    type: 'fixed',
    value: 'fixed:Plugin',
    name: 'Plugin',
  });
});

it('groups both role families by app ID without changing the role objects', () => {
  const pluginRole = { ...resourceRole, name: 'plugins:example-plugin-app:cli-user', group: 'Example Plugin' };
  const expected = { type: 'plugin', value: 'app:example-plugin-app', name: 'Example Plugin' };
  expect(getRolePickerGroup(resourceRole, [app])).toEqual(expected);
  expect(getRolePickerGroup(pluginRole, [app])).toEqual(expected);
  expect(resourceRole.name).toBe('fixed:plugin.ext.grafana.app:plugin:resources-reader');
});

it.each([
  ['fixed:plugin.ext.grafana.app.other:reader', 'fixed'],
  ['plugins:example-plugin-app-other:reader', 'plugin'],
  ['custom:plugin.ext.grafana.app:reader', 'custom'],
])('does not group a similarly named or custom role (%s)', (name, type) => {
  expect(getRolePickerGroup({ ...resourceRole, name, group: 'Example Plugin' }, [app])).toEqual({
    type,
    value: `${name.split(':')[0]}:Example Plugin`,
    name: 'Example Plugin',
  });
});

it('keeps the original group when multiple apps claim the same API group', () => {
  expect(getRolePickerGroup(resourceRole, [app, { ...app, id: 'another-app' }])).toEqual({
    type: 'fixed',
    value: 'fixed:Plugin',
    name: 'Plugin',
  });
});
