import { render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import {
  type ComponentTypeWithExtensionMeta,
  CoreApp,
  type DataSourceInstanceSettings,
  type PluginExtensionQueryEditorRowActionsV1Context,
  PluginExtensionPoints,
  PluginExtensionTypes,
  type PluginMeta,
  PluginType,
  dateTime,
  type TimeRange,
} from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { type DataQuery } from '@grafana/schema';
import { getMockDataSourceMeta } from 'app/features/datasources/mocks/dataSourcesMocks';
import { ExtensionRegistriesProvider } from 'app/features/plugins/extensions/ExtensionRegistriesContext';
import { AddedComponentsRegistry } from 'app/features/plugins/extensions/registry/AddedComponentsRegistry';
import { AddedFunctionsRegistry } from 'app/features/plugins/extensions/registry/AddedFunctionsRegistry';
import { AddedLinksRegistry } from 'app/features/plugins/extensions/registry/AddedLinksRegistry';
import { ExposedComponentsRegistry } from 'app/features/plugins/extensions/registry/ExposedComponentsRegistry';

import { QueryEditorRowExtensionActions } from './QueryEditorRowExtensionActions';

jest.mock('app/features/plugins/extensions/useLoadAppPlugins', () => ({
  useLoadAppPlugins: () => ({ isLoading: false }),
}));

const pluginId = 'myorg-sqldebug-app';

const query: DataQuery & { rawSql?: string } = { refId: 'A', rawSql: 'SELECT 1' };

const timeRange: TimeRange = {
  from: dateTime('2024-01-01T00:00:00Z'),
  to: dateTime('2024-01-01T01:00:00Z'),
  raw: { from: 'now-1h', to: 'now' },
};

const dataSource: DataSourceInstanceSettings = {
  uid: 'ds-uid',
  type: 'grafana-postgresql-datasource',
  name: 'My Postgres',
  meta: getMockDataSourceMeta(),
  readOnly: false,
  access: 'proxy',
  jsonData: {},
};

// The props are modelled as optional so the components stay assignable to the `{}`-props
// component type that `setPluginComponentsHook` is typed with.
type ActionContext = Partial<PluginExtensionQueryEditorRowActionsV1Context>;
type ActionComponent = React.ComponentType<ActionContext>;

function createComponent(id: string, Component: ActionComponent): ComponentTypeWithExtensionMeta<ActionContext> {
  return Object.assign(Component, {
    meta: {
      id,
      pluginId,
      title: 'Debug SQL query',
      description: '',
      type: PluginExtensionTypes.component as const,
    },
  });
}

describe('QueryEditorRowExtensionActions', () => {
  it('renders nothing when no plugin registers an action', () => {
    setPluginComponentsHook(() => ({ components: [], isLoading: false }));

    const { container } = render(<QueryEditorRowExtensionActions query={query} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while the extension point is loading', () => {
    setPluginComponentsHook(() => ({
      components: [createComponent('one', () => <button>Debug</button>)],
      isLoading: true,
    }));

    const { container } = render(<QueryEditorRowExtensionActions query={query} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders every registered action', () => {
    setPluginComponentsHook(() => ({
      components: [
        createComponent('one', () => <button>First</button>),
        createComponent('two', () => <button>Second</button>),
      ],
      isLoading: false,
    }));

    render(<QueryEditorRowExtensionActions query={query} />);

    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Second' })).toBeInTheDocument();
  });

  it('passes the query, datasource, app and raw time range to the action', () => {
    const received: ActionContext[] = [];

    setPluginComponentsHook(() => ({
      components: [
        createComponent('one', (props) => {
          received.push(props);
          return null;
        }),
      ],
      isLoading: false,
    }));

    render(
      <QueryEditorRowExtensionActions
        query={query}
        queries={[query, { refId: 'B' }]}
        dataSource={dataSource}
        app={CoreApp.Explore}
        timeRange={timeRange}
      />
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      query: { refId: 'A', rawSql: 'SELECT 1' },
      queries: [{ refId: 'A' }, { refId: 'B' }],
      dataSource: { uid: 'ds-uid', type: 'grafana-postgresql-datasource', name: 'My Postgres' },
      app: CoreApp.Explore,
      timeRange: { from: 'now-1h', to: 'now' },
    });
  });

  it('omits the datasource and time range when the row has not resolved them yet', () => {
    const received: ActionContext[] = [];

    setPluginComponentsHook(() => ({
      components: [
        createComponent('one', (props) => {
          received.push(props);
          return null;
        }),
      ],
      isLoading: false,
    }));

    render(<QueryEditorRowExtensionActions query={query} />);

    expect(received[0].dataSource).toBeUndefined();
    expect(received[0].timeRange).toBeUndefined();
  });

  // These go through the real extension registry instead of a stubbed hook, so they cover the
  // path a plugin actually takes when it calls `addComponent()` against this extension point.
  describe('with the real extension registry', () => {
    const pluginMeta: PluginMeta = {
      id: pluginId,
      name: 'SQL Debug',
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

    function setup(component: ActionComponent) {
      // The global test setup stubs `usePluginComponents` out for every test, so reach for the
      // real implementation and wire it into the `@grafana/runtime` singleton the component uses.
      const { usePluginComponents } = jest.requireActual('app/features/plugins/extensions/usePluginComponents');
      setPluginComponentsHook(usePluginComponents);

      const addedComponentsRegistry = new AddedComponentsRegistry([]);
      addedComponentsRegistry.register({
        pluginId,
        pluginMeta,
        configs: [
          {
            targets: [PluginExtensionPoints.QueryEditorRowActions],
            title: 'Debug SQL query',
            description: 'Opens the SQL debugger for this query',
            component,
          },
        ],
      });

      const registries = {
        addedComponentsRegistry,
        addedLinksRegistry: new AddedLinksRegistry([]),
        exposedComponentsRegistry: new ExposedComponentsRegistry([]),
        addedFunctionsRegistry: new AddedFunctionsRegistry([]),
      };

      return render(
        <QueryEditorRowExtensionActions
          query={query}
          queries={[query]}
          dataSource={dataSource}
          app={CoreApp.PanelEditor}
        />,
        {
          wrapper: ({ children }: { children: ReactNode }) => (
            <ExtensionRegistriesProvider registries={registries}>{children}</ExtensionRegistriesProvider>
          ),
        }
      );
    }

    it('renders a component registered by a plugin through addComponent()', async () => {
      setup(() => <button>Debug SQL query</button>);

      expect(await screen.findByRole('button', { name: 'Debug SQL query' })).toBeInTheDocument();
    });

    it('gives the plugin the datasource uid and type it needs to run the query', async () => {
      const received: ActionContext[] = [];

      setup((props) => {
        received.push(props);
        return null;
      });

      await waitFor(() => expect(received.length).toBeGreaterThan(0));

      expect(received[0].dataSource).toEqual({
        uid: 'ds-uid',
        type: 'grafana-postgresql-datasource',
        name: 'My Postgres',
      });
      expect(received[0].query).toMatchObject({ refId: 'A', rawSql: 'SELECT 1' });
      expect(received[0].app).toBe(CoreApp.PanelEditor);
    });

    it('renders nothing when the plugin component opts out for this query', async () => {
      const { container } = setup(() => null);

      await waitFor(() => expect(container).toBeEmptyDOMElement());
    });
  });
});
