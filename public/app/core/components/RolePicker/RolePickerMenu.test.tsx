import { fireEvent, render, screen, waitFor, within } from 'test/test-utils';

import { type AppPluginConfig, PluginLoadingStrategy } from '@grafana/data';
import { setAppPluginMetas } from '@grafana/runtime/internal';
import { type Role } from 'app/types/accessControl';

import { RolePickerMenu } from './RolePickerMenu';

const app: AppPluginConfig = {
  id: 'example-plugin-app',
  name: 'Example Plugin',
  appPlatformRoleGroup: 'plugin.ext.grafana.app',
  path: '',
  version: '1.0.0',
  preload: false,
  angular: { detected: false, hideDeprecation: false },
  loadingStrategy: PluginLoadingStrategy.script,
  dependencies: { grafanaDependency: '*', grafanaVersion: '*', plugins: [], extensions: { exposedComponents: [] } },
  extensions: { addedLinks: [], addedComponents: [], addedFunctions: [], exposedComponents: [], extensionPoints: [] },
};
const resource: Role = {
  uid: 'resources',
  name: 'fixed:plugin.ext.grafana.app:plugin:resources-reader',
  group: 'Plugin',
  displayName: 'Resources Reader',
  filteredDisplayName: 'Plugin:Resources Reader',
  description: '',
  version: 1,
  created: '2026-01-01T00:00:00Z',
  updated: '2026-01-01T00:00:00Z',
  delegatable: true,
};
const cli: Role = {
  ...resource,
  uid: 'cli',
  name: 'plugins:example-plugin-app:cli-user',
  group: 'Example Plugin',
  displayName: 'Plugin CLI User',
  filteredDisplayName: 'Example Plugin:Plugin CLI User',
};
const other: Role = {
  ...resource,
  uid: 'other',
  name: 'fixed:other:reader',
  group: 'Other product',
  displayName: 'Other Reader',
};

beforeEach(() => setAppPluginMetas({ [app.id]: app }));
afterEach(() => setAppPluginMetas({}));

function setup(options: Role[] = [resource, cli, other], appliedRoles: Role[] = []) {
  const onUpdate = jest.fn();
  const onSelect = jest.fn();
  const view = render(
    <RolePickerMenu
      options={options}
      appliedRoles={appliedRoles}
      onSelect={onSelect}
      onUpdate={onUpdate}
      showGroups
      offset={{ horizontal: 0, vertical: 0 }}
    />
  );
  return { ...view, onUpdate, onSelect };
}

async function combinedGroup() {
  await waitFor(() => {
    expect(screen.getByText('Example Plugin')).toBeInTheDocument();
    expect(screen.queryByText('Plugin')).not.toBeInTheDocument();
  });
  return screen.getByText('Example Plugin').closest<HTMLElement>('[aria-label="Role picker option"]')!;
}

it('keeps fixed and plugin groups separate when the setting is omitted', async () => {
  setAppPluginMetas({ [app.id]: { ...app, appPlatformRoleGroup: undefined } });
  const { user } = setup();
  const group = await screen.findByText('Plugin');
  await user.hover(group);
  expect(await screen.findByText('Resources Reader')).toBeInTheDocument();
  expect(screen.getByText('Fixed roles')).toBeInTheDocument();
  expect(screen.getByText('Example Plugin')).toBeInTheDocument();
  expect(screen.queryByText('Plugin CLI User')).not.toBeInTheDocument();
});

it('shows both families together and submits their original roles on group selection', async () => {
  const { user, onUpdate } = setup();
  const group = await combinedGroup();
  await user.hover(group);
  expect(await screen.findByText('Resources Reader')).toBeInTheDocument();
  expect(screen.getByText('Plugin CLI User')).toBeInTheDocument();
  await user.click(within(group).getByRole('checkbox'));
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenCalledWith([resource, cli], undefined);
});

it('clears both families while preserving mapped, non-delegatable, and unrelated assignments', async () => {
  const mapped = { ...cli, uid: 'mapped', name: 'plugins:example-plugin-app:mapped', mapped: true };
  const locked = {
    ...resource,
    uid: 'locked',
    name: 'fixed:plugin.ext.grafana.app:locked',
    displayName: 'Locked resource role',
    delegatable: false,
  };
  const { user, onUpdate } = setup([resource, cli, mapped, locked, other], [resource, cli, mapped, locked, other]);
  await user.hover(await combinedGroup());
  expect(await screen.findByText('Resources Reader')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenCalledWith([mapped, locked, other], undefined);
});

it('preserves the partial-group toggle behavior and non-delegatable assignments', async () => {
  const locked = {
    ...resource,
    uid: 'locked',
    name: 'fixed:plugin.ext.grafana.app:locked',
    displayName: 'Locked resource role',
    delegatable: false,
  };
  const { user, onUpdate } = setup([resource, cli, locked, other], [resource, locked, other]);
  const checkbox = within(await combinedGroup()).getByRole('checkbox');
  expect(checkbox).toBeChecked();
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenLastCalledWith([other, locked], undefined);
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenLastCalledWith([other, resource, cli, locked], undefined);
});

it('lets a caller select an App Platform role even when no plugin roles are available', async () => {
  const { user, onUpdate } = setup([resource, other]);
  await user.hover(await combinedGroup());
  fireEvent.click(await screen.findByText('Resources Reader'));
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenCalledWith([resource], undefined);
});

it('keeps filtered results individually selectable without assigning the rest of the app group', async () => {
  const onUpdate = jest.fn();
  const { user } = render(
    <RolePickerMenu
      options={[resource]}
      appliedRoles={[]}
      onSelect={jest.fn()}
      onUpdate={onUpdate}
      isFiltered
      showGroups={false}
      offset={{ horizontal: 0, vertical: 0 }}
    />
  );
  expect(await screen.findByText('Plugin roles')).toBeInTheDocument();
  expect(screen.getByText('Plugin:Resources Reader')).toBeInTheDocument();
  await user.click(screen.getByText('Plugin:Resources Reader'));
  await user.click(screen.getByRole('button', { name: 'Update' }));
  expect(onUpdate).toHaveBeenCalledWith([resource], undefined);
});
