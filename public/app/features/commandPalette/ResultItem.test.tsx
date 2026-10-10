import { ActionImpl } from 'kbar';
import { type ReactNode } from 'react';
import { render, screen } from 'test/test-utils';

import {
  type ComponentTypeWithExtensionMeta,
  type PluginExtensionCommandPaletteResultItemV1Context,
  PluginExtensionPoints,
  PluginExtensionTypes,
  type PluginMeta,
  PluginType,
} from '@grafana/data';
import { config, setPluginComponentsHook } from '@grafana/runtime';
import { ManagerKind } from 'app/features/apiserver/types';
import { ExtensionRegistriesProvider } from 'app/features/plugins/extensions/ExtensionRegistriesContext';
import { AddedComponentsRegistry } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from 'app/features/plugins/extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from 'app/features/plugins/extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from 'app/features/plugins/extensions/registry/ExposedComponentsRegistry';

import { ResultItem } from './ResultItem';

jest.mock('app/features/plugins/extensions/useLoadAppPlugins', () => ({
  useLoadAppPlugins: () => ({ isLoading: false }),
}));

const pluginId = 'myorg-owner-app';

// The props are modelled as optional so the components stay assignable to the `{}`-props
// component type that `setPluginComponentsHook` is typed with.
type ResultItemContext = Partial<PluginExtensionCommandPaletteResultItemV1Context>;
type ResultItemComponent = React.ComponentType<ResultItemContext>;

function createComponent(Component: ResultItemComponent): ComponentTypeWithExtensionMeta<ResultItemContext> {
  return Object.assign(Component, {
    meta: {
      id: 'owner',
      pluginId,
      title: 'Dashboard owner',
      description: '',
      type: PluginExtensionTypes.component as const,
    },
  });
}

const OwnerBadge = () => <span>Owner: Hello World</span>;

function createActionImpl(props: Record<string, unknown> = {}): ActionImpl {
  const action = {
    id: 'test-action',
    name: 'Test Dashboard',
    ...props,
  };
  return ActionImpl.create(action, { store: {} });
}

describe('ResultItem', () => {
  let originalProvisioning: boolean;

  beforeEach(() => {
    originalProvisioning = config.provisioningEnabled;
  });

  afterEach(() => {
    config.provisioningEnabled = originalProvisioning;
  });

  it('renders the action name', () => {
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is Repo and provisioning toggle is on', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not render the managed badge when managedBy is undefined', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl();
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders the managed badge when managedBy is a non-Repo kind', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Terraform });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('renders the managed badge for plugin-managed resources', () => {
    config.provisioningEnabled = true;
    const action = createActionImpl({ managedBy: ManagerKind.Plugin });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not render the managed badge when provisioning toggle is off', () => {
    config.provisioningEnabled = false;
    const action = createActionImpl({ managedBy: ManagerKind.Repo });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('does not render dashboard tags itself when no plugin extends the row', () => {
    const action = createActionImpl({
      sectionId: 'dashboards',
      uid: 'abc',
      url: '/d/abc/my-dashboard',
      tags: ['prod', 'team-a'],
    });
    render(<ResultItem action={action} active={false} currentRootActionId="" />);
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('prod')).not.toBeInTheDocument();
  });

  describe('plugin extensions', () => {
    const dashboardAction = {
      id: 'go/dashboard/d/abc/my-dashboard',
      name: 'My dashboard',
      sectionId: 'dashboards',
      uid: 'abc',
      url: '/d/abc/my-dashboard',
      subtitle: 'Team folder',
      tags: ['prod'],
    };

    afterEach(() => {
      setPluginComponentsHook(() => ({ components: [], isLoading: false }));
    });

    it('passes the dashboard uid, title, url, tags and folder title to the plugin component', () => {
      const received: ResultItemContext[] = [];
      setPluginComponentsHook(() => ({
        components: [
          createComponent((props) => {
            received.push(props);
            return null;
          }),
        ],
        isLoading: false,
      }));

      render(<ResultItem action={createActionImpl(dashboardAction)} active={false} currentRootActionId="" />);

      expect(received.at(-1)).toEqual({
        kind: 'dashboard',
        uid: 'abc',
        title: 'My dashboard',
        url: '/d/abc/my-dashboard',
        tags: ['prod'],
        folderTitle: 'Team folder',
      });
    });

    it.each([
      { desc: 'an empty tag array to the plugin component when the dashboard has no tags', tags: [], expected: [] },
      // Hybrid search results carry no tag data at all
      {
        desc: 'no tags to the plugin component when the search source does not provide them',
        tags: undefined,
        expected: undefined,
      },
    ])('passes $desc', ({ tags, expected }) => {
      const received: ResultItemContext[] = [];
      setPluginComponentsHook(() => ({
        components: [
          createComponent((props) => {
            received.push(props);
            return null;
          }),
        ],
        isLoading: false,
      }));

      render(
        <ResultItem action={createActionImpl({ ...dashboardAction, tags })} active={false} currentRootActionId="" />
      );

      expect(received.at(-1)?.uid).toBe('abc');
      expect(received.at(-1)?.tags).toEqual(expected);
    });

    it('renders plugin content on recent dashboard rows', () => {
      setPluginComponentsHook(() => ({ components: [createComponent(OwnerBadge)], isLoading: false }));

      render(
        <ResultItem
          action={createActionImpl({ ...dashboardAction, sectionId: 'recent-dashboards' })}
          active={false}
          currentRootActionId=""
        />
      );

      expect(screen.getByText('Owner: Hello World')).toBeInTheDocument();
    });

    it('does not render plugin content on folder rows', () => {
      setPluginComponentsHook(() => ({ components: [createComponent(OwnerBadge)], isLoading: false }));

      render(
        <ResultItem
          action={createActionImpl({ ...dashboardAction, sectionId: 'folders', url: '/dashboards/f/abc' })}
          active={false}
          currentRootActionId=""
        />
      );

      expect(screen.getByText('My dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Owner: Hello World')).not.toBeInTheDocument();
    });

    it('does not render plugin content while the extension point is loading', () => {
      setPluginComponentsHook(() => ({ components: [createComponent(OwnerBadge)], isLoading: true }));

      render(<ResultItem action={createActionImpl(dashboardAction)} active={false} currentRootActionId="" />);

      expect(screen.getByText('My dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Owner: Hello World')).not.toBeInTheDocument();
    });

    // Goes through the real extension registry instead of a stubbed hook, so it covers the path a
    // plugin actually takes when it calls `addComponent()` against this extension point.
    it('renders a component registered by a plugin through addComponent()', async () => {
      // The global test setup stubs `usePluginComponents` out for every test, so reach for the
      // real implementation and wire it into the `@grafana/runtime` singleton the component uses.
      const { usePluginComponents } = jest.requireActual('app/features/plugins/extensions/usePluginComponents');
      setPluginComponentsHook(usePluginComponents);

      const pluginMeta: PluginMeta = {
        id: pluginId,
        name: 'Owner',
        type: PluginType.app,
        module: `plugins/${pluginId}/module`,
        baseUrl: '',
        info: {
          author: { name: 'Grafana Labs' },
          description: '',
          links: [],
          logos: { large: '', small: '' },
          screenshots: [],
          updated: '',
          version: '1.0.0',
        },
      };
      const addedComponentsRegistry = new AddedComponentsRegistry([]);
      addedComponentsRegistry.register({
        pluginId,
        pluginMeta,
        configs: [
          {
            targets: [PluginExtensionPoints.CommandPaletteResultItem],
            title: 'Dashboard owner',
            description: 'Shows the dashboard owner',
            component: OwnerBadge,
          },
        ],
      });
      const registries = {
        addedComponentsRegistry,
        addedLinksRegistry: new AddedLinksRegistry([]),
        exposedComponentsRegistry: new ExposedComponentsRegistry([]),
        addedFunctionsRegistry: new AddedFunctionsRegistry([]),
      };

      render(<ResultItem action={createActionImpl(dashboardAction)} active={false} currentRootActionId="" />, {
        wrapper: ({ children }: { children: ReactNode }) => (
          <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
        ),
      });

      expect(await screen.findByText('Owner: Hello World')).toBeInTheDocument();
    });
  });

  it('appends an ellipsis to a parent action that has children but no command or link', () => {
    const parent = createActionImpl({ name: 'Preferences' });
    parent.addChild(createActionImpl({ id: 'child-action', name: 'Theme' }));
    render(<ResultItem action={parent} active={false} currentRootActionId="" />);
    expect(screen.getByText('Preferences...')).toBeInTheDocument();
  });

  it('renders ancestor breadcrumbs when no root action is selected', () => {
    const parent = createActionImpl({ id: 'set-theme', name: 'Set theme' });
    const child = createActionImpl({ id: 'dark', name: 'Dark' });
    parent.addChild(child);
    render(<ResultItem action={child} active={false} currentRootActionId="" />);
    expect(screen.getByText('Set theme')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('drops the current root action from the breadcrumbs', () => {
    const parent = createActionImpl({ id: 'set-theme', name: 'Set theme' });
    const child = createActionImpl({ id: 'dark', name: 'Dark' });
    parent.addChild(child);
    render(<ResultItem action={child} active={false} currentRootActionId="set-theme" />);
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.queryByText('Set theme')).not.toBeInTheDocument();
  });
});
