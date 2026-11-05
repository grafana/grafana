import { screen, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { Provider } from 'react-redux';

import { type DataSourceJsonData, type PluginExtensionDataSourceConfigContext, PluginState } from '@grafana/data';
import { setPluginComponentsHook, setPluginLinksHook, useDataSourceInstanceSettings } from '@grafana/runtime';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { configureStore } from 'app/store/configureStore';

import { type DataSourceSettingsK8s } from '../api';
import { getMockDataSource, getMockDataSourceMeta, getMockDataSourceSettingsState } from '../mocks/dataSourcesMocks';

import { missingRightsMessage } from './DataSourceMissingRightsMessage';
import { readOnlyMessage } from './DataSourceReadOnlyMessage';
import { EditDataSourceView, type ViewProps } from './EditDataSource';

const onOptionsChange = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceSettings: jest.fn((uid?: string) => ({
    isLoading: false,
    settings: uid
      ? {
          uid,
          meta: getMockDataSourceMeta(),
        }
      : undefined,
  })),
}));

setPluginLinksHook(() => ({ links: [], isLoading: false }));

const setup = (props?: Partial<ViewProps>) => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <EditDataSourceView
        dataSource={getMockDataSource()}
        dataSourceMeta={getMockDataSourceMeta()}
        dataSourceSettings={getMockDataSourceSettingsState()}
        dataSourceRights={{ readOnly: false, hasWriteRights: true, hasDeleteRights: true }}
        exploreUrl={'/explore'}
        onDelete={jest.fn()}
        onOptionsChange={onOptionsChange}
        onTest={jest.fn()}
        onUpdate={jest.fn()}
        {...props}
      />
    </Provider>
  );
};

describe('<EditDataSource>', () => {
  beforeEach(() => {
    setPluginComponentsHook(jest.fn().mockReturnValue({ isLoading: false, components: [] }));
    onOptionsChange.mockClear();
  });

  describe('On loading errors', () => {
    it('should render a Back button', () => {
      setup({
        dataSource: getMockDataSource({ name: 'My Datasource' }),
        dataSourceSettings: getMockDataSourceSettingsState({ loadError: 'Some weird error.' }),
      });

      expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
      expect(screen.queryByText('My Datasource')).not.toBeInTheDocument();
      expect(screen.queryByText('Back')).toBeVisible();
    });

    it('should render a Delete button if the user has rights delete the datasource', () => {
      setup({
        dataSourceSettings: getMockDataSourceSettingsState({ loadError: 'Some weird error.' }),
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: true,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText('Delete')).toBeVisible();
    });

    it('should not render a Delete button if the user has no rights to delete the datasource', () => {
      setup({
        dataSourceSettings: getMockDataSourceSettingsState({ loadError: 'Some weird error.' }),
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: false,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });

    it('should render a message if the datasource is read-only', () => {
      setup({
        dataSourceSettings: getMockDataSourceSettingsState({ loadError: 'Some weird error.' }),
        dataSourceRights: {
          readOnly: true,
          hasDeleteRights: false,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText(readOnlyMessage)).toBeVisible();
    });

    it('should render a message if the datasource is not found', () => {
      setup({
        dataSource: getMockDataSource({ uid: undefined, id: 0 }),
      });

      expect(screen.queryByText('Data source not found')).toBeVisible();
    });
  });

  describe('On loading', () => {
    it('should render a loading indicator while the data is being fetched', () => {
      setup({
        dataSource: getMockDataSource({ name: 'My Datasource' }),
        dataSourceSettings: getMockDataSourceSettingsState({ loading: true }),
      });

      expect(screen.queryByText('Loading ...')).toBeVisible();
      expect(screen.queryByText('My Datasource')).not.toBeInTheDocument();
    });

    it('should render a loading indicator while the data source instance settings are being fetched', () => {
      jest.mocked(useDataSourceInstanceSettings).mockReturnValueOnce({ isLoading: true });

      setup({
        dataSource: getMockDataSource({ name: 'My Datasource' }),
      });

      expect(screen.queryByText('Loading ...')).toBeVisible();
      expect(screen.queryByText('My Datasource')).not.toBeInTheDocument();
    });

    it('should not render loading when data is already available', () => {
      setup();

      expect(screen.queryByText('Loading ...')).not.toBeInTheDocument();
    });
  });

  describe('On editing', () => {
    it('should render no messages if the user has write access and if the data-source is not read-only', () => {
      setup({
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: true,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText(readOnlyMessage)).not.toBeInTheDocument();
      expect(screen.queryByText(missingRightsMessage)).not.toBeInTheDocument();
    });

    it('should render a message if the user has no write access', () => {
      setup({
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: false,
          hasWriteRights: false,
        },
      });

      expect(screen.queryByText(missingRightsMessage)).toBeVisible();
    });

    it('should render a message if the data-source is read-only', () => {
      setup({
        dataSourceRights: {
          readOnly: true,
          hasDeleteRights: false,
          hasWriteRights: false,
        },
      });

      expect(screen.queryByText(readOnlyMessage)).toBeVisible();
    });

    it('should render a beta info message if the plugin is still in Beta state', () => {
      setup({
        dataSourceMeta: getMockDataSourceMeta({
          state: PluginState.beta,
        }),
      });

      expect(screen.getByTitle('This feature is close to complete but not fully tested')).toBeVisible();
    });

    it('should render an alpha info message if the plugin is still in Alpha state', () => {
      setup({
        dataSourceMeta: getMockDataSourceMeta({
          state: PluginState.alpha,
        }),
      });

      expect(
        screen.getByTitle('This feature is experimental and future updates might not be backward compatible')
      ).toBeVisible();
    });

    it('should render testing errors with a detailed error message', () => {
      const message = 'message';
      const detailsMessage = 'detailed message';

      setup({
        dataSourceSettings: getMockDataSourceSettingsState({
          testingStatus: {
            message,
            status: 'error',
            details: { message: detailsMessage },
          },
        }),
      });

      expect(screen.getByText(message)).toBeVisible();
      expect(screen.getByText(detailsMessage)).toBeVisible();
    });

    it('should render testing errors with empty details', () => {
      const message = 'message';

      setup({
        dataSourceSettings: getMockDataSourceSettingsState({
          testingStatus: {
            message,
            status: 'error',
            details: {},
          },
        }),
      });

      expect(screen.getByText(message)).toBeVisible();
    });

    it('should render testing errors with no details', () => {
      const message = 'message';

      setup({
        dataSourceSettings: getMockDataSourceSettingsState({
          testingStatus: {
            message,
            status: 'error',
          },
        }),
      });

      expect(screen.getByText(message)).toBeVisible();
    });

    it('should use the verboseMessage property in the error details whenever it is available', () => {
      const message = 'message';
      const detailsMessage = 'detailed message';
      const detailsVerboseMessage = 'even more detailed...';

      setup({
        dataSourceSettings: getMockDataSourceSettingsState({
          testingStatus: {
            message,
            status: 'error',
            details: {
              details: detailsMessage,
              verboseMessage: detailsVerboseMessage,
            },
          },
        }),
      });

      expect(screen.queryByText(message)).toBeVisible();
      expect(screen.queryByText(detailsMessage)).not.toBeInTheDocument();
      expect(screen.queryByText(detailsVerboseMessage)).toBeInTheDocument();
    });
  });

  describe('when extending the datasource config form', () => {
    it('should be possible to extend the form with a "component" extension in case the plugin ID is whitelisted', () => {
      const message = "I'm a UI extension component!";

      setPluginComponentsHook(
        jest.fn().mockReturnValue({
          isLoading: false,
          components: [
            createComponentWithMeta(
              {
                pluginId: 'grafana-pdc-app',
                title: 'Example component',
                description: 'Example description',
                component: () => <div>{message}</div>,
              },
              '1'
            ),
          ],
        })
      );

      setup({
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: true,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText(message)).toBeVisible();
    });

    it('should NOT be possible to extend the form with a "component" extension in case the plugin ID is NOT whitelisted', () => {
      const message = "I'm a UI extension component!";

      setPluginComponentsHook(
        jest.fn().mockReturnValue({
          isLoading: false,
          components: [
            createComponentWithMeta(
              {
                pluginId: 'myorg-basic-app',
                title: 'Example component',
                description: 'Example description',
                component: () => <div>{message}</div>,
              },
              '1'
            ),
          ],
        })
      );

      setup({
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: true,
          hasWriteRights: true,
        },
      });

      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });

    it('should pass a context prop to the rendered UI extension component', () => {
      const message = "I'm a UI extension component!";
      const Component = jest.fn().mockReturnValue(<div>{message}</div>);

      setPluginComponentsHook(
        jest.fn().mockReturnValue({
          isLoading: false,
          components: [
            createComponentWithMeta(
              {
                pluginId: 'grafana-pdc-app',
                title: 'Example component',
                description: 'Example description',
                component: Component,
              },
              '1'
            ),
          ],
        })
      );

      setup({
        dataSourceRights: {
          readOnly: false,
          hasDeleteRights: true,
          hasWriteRights: true,
        },
      });

      expect(Component).toHaveBeenCalled();

      const props = Component.mock.calls[0][0];

      expect(props.context).toBeDefined();
      expect(props.context.dataSource).toBeDefined();
      expect(props.context.dataSourceMeta).toBeDefined();
      expect(props.context.setJsonData).toBeDefined();
      expect(props.context.setSecureJsonData).toBeDefined();
      expect(props.context.testingStatus).toBeDefined();
    });
  });

  it('should be possible to update the `jsonData` first and `secureJsonData` directly afterwards from the extension component', () => {
    const message = "I'm a UI extension component!";
    const Component = ({ context }: { context: PluginExtensionDataSourceConfigContext }) => {
      useEffect(() => {
        context.setJsonData({ test: 'test' } as unknown as DataSourceJsonData);
        context.setSecureJsonData({ test: 'test' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <div>{message}</div>;
    };

    setPluginComponentsHook(
      jest.fn().mockReturnValue({
        isLoading: false,
        components: [
          createComponentWithMeta(
            {
              pluginId: 'grafana-pdc-app',
              title: 'Example component',
              description: 'Example description',
              component: Component as unknown as React.ComponentType<{}>,
            },
            '1'
          ),
        ],
      })
    );

    setup({
      dataSourceRights: {
        readOnly: false,
        hasDeleteRights: true,
        hasWriteRights: true,
      },
    });

    expect(onOptionsChange).toHaveBeenCalledTimes(2);
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...getMockDataSource(),
      jsonData: { ...getMockDataSource().jsonData, test: 'test' },
      secureJsonData: { test: 'test' },
    });
  });

  it('should be possible to update the `secureJsonData` first and `jsonData` directly afterwards from the extension component', () => {
    const message = "I'm a UI extension component!";
    const Component = ({ context }: { context: PluginExtensionDataSourceConfigContext }) => {
      useEffect(() => {
        context.setSecureJsonData({ test: 'test' });
        context.setJsonData({ test: 'test' } as unknown as DataSourceJsonData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      return <div>{message}</div>;
    };

    setPluginComponentsHook(
      jest.fn().mockReturnValue({
        isLoading: false,
        components: [
          createComponentWithMeta(
            {
              pluginId: 'grafana-pdc-app',
              title: 'Example component',
              description: 'Example description',
              component: Component as unknown as React.ComponentType<{}>,
            },
            '1'
          ),
        ],
      })
    );

    setup({
      dataSourceRights: {
        readOnly: false,
        hasDeleteRights: true,
        hasWriteRights: true,
      },
    });

    expect(onOptionsChange).toHaveBeenCalledTimes(2);
    expect(onOptionsChange).toHaveBeenCalledWith({
      ...getMockDataSource(),
      jsonData: { ...getMockDataSource().jsonData, test: 'test' },
      secureJsonData: { test: 'test' },
    });
  });
});

describe('<EditDataSource> provisioning', () => {
  const managedResource = (annotations: Record<string, string>): DataSourceSettingsK8s => ({
    apiVersion: 'prometheus.datasource.grafana.app/v0alpha1',
    kind: 'DataSource',
    metadata: { name: getMockDataSource().uid, annotations },
    spec: {
      access: 'proxy',
      title: getMockDataSource().name,
      url: '',
      user: '',
      database: '',
      basicAuth: false,
      basicAuthUser: '',
    },
  });

  const repoManaged = managedResource({
    'grafana.app/managedBy': 'repo',
    'grafana.app/managerId': 'test-repo',
    'grafana.app/sourcePath': 'datasources/prom.json',
  });

  const terraformManaged = managedResource({ 'grafana.app/managedBy': 'terraform' });

  beforeEach(() => {
    setPluginComponentsHook(jest.fn().mockReturnValue({ isLoading: false, components: [] }));
  });

  it('renders no provisioning surfaces for an unmanaged data source', () => {
    setup();

    expect(screen.queryByText('Managed data source')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save & test/i })).toBeEnabled();
  });

  it('keeps a repository-managed data source editable', () => {
    setup({ provisioning: { resource: repoManaged, isLoading: false } });

    // Git Sync has its own edit workflow, so the page must not fall back to read-only.
    expect(screen.queryByText('Managed data source')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save & test/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeEnabled();
  });

  it('commits a repository-managed data source through the provisioning drawer instead of saving it directly', async () => {
    const onUpdate = jest.fn();
    const onTest = jest.fn();
    setup({ provisioning: { resource: repoManaged, isLoading: false }, onUpdate, onTest });

    await userEvent.click(screen.getByRole('button', { name: /save & test/i }));

    await waitFor(() => expect(screen.getByRole('heading', { name: /save provisioned data source/i })).toBeVisible());
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onTest).not.toHaveBeenCalled();
  });

  it('makes a data source read-only when another manager owns it and disallows edits', () => {
    setup({ provisioning: { resource: terraformManaged, isLoading: false } });

    expect(screen.getByText(/managed externally and cannot be modified/i)).toBeVisible();
    // ButtonRow swaps "Save & test" for a bare "Test" when saving is not allowed.
    expect(screen.queryByRole('button', { name: /save & test/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^test$/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /^delete$/i })).toBeDisabled();
  });

  it('renders a loading indicator while the provisioning state is being read', () => {
    setup({ provisioning: { isLoading: true } });

    expect(screen.getByText('Loading ...')).toBeInTheDocument();
  });
});
