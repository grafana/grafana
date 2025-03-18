import { screen, render } from '@testing-library/react';
import { Provider } from 'react-redux';

import { PluginExtensionTypes, PluginState } from '@grafana/data';
import { setAngularLoader, setPluginExtensionsHook } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';

import { getMockDataSource, getMockDataSourceMeta, getMockDataSourceSettingsState } from '../__mocks__';

import { missingRightsMessage } from './DataSourceMissingRightsMessage';
import { readOnlyMessage } from './DataSourceReadOnlyMessage';
import { EditDataSourceView, ViewProps } from './EditDataSource';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    getDataSourceSrv: jest.fn(() => ({
      getInstanceSettings: (uid: string) => ({
        uid,
        meta: getMockDataSourceMeta(),
      }),
    })),
  };
});

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
        onDefaultChange={jest.fn()}
        onNameChange={jest.fn()}
        onOptionsChange={jest.fn()}
        onTest={jest.fn()}
        onUpdate={jest.fn()}
        {...props}
      />
    </Provider>
  );
};

describe('<EditDataSource>', () => {
  beforeAll(() => {
    setAngularLoader({
      load: () => ({
        destroy: jest.fn(),
        digest: jest.fn(),
        getScope: () => ({ $watch: () => {} }),
      }),
    });
  });

  beforeEach(() => {
    setPluginExtensionsHook(jest.fn().mockReturnValue({ extensions: [] }));
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

      setPluginExtensionsHook(
        jest.fn().mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: 'grafana-pdc-app',
              type: PluginExtensionTypes.component,
              title: 'Example component',
              description: 'Example description',
              component: () => <div>{message}</div>,
            },
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

      setPluginExtensionsHook(
        jest.fn().mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: 'myorg-basic-app',
              type: PluginExtensionTypes.component,
              title: 'Example component',
              description: 'Example description',
              component: () => <div>{message}</div>,
            },
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
      const component = jest.fn().mockReturnValue(<div>{message}</div>);

      setPluginExtensionsHook(
        jest.fn().mockReturnValue({
          extensions: [
            {
              id: '1',
              pluginId: 'grafana-pdc-app',
              type: PluginExtensionTypes.component,
              title: 'Example component',
              description: 'Example description',
              component,
            },
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

      expect(component).toHaveBeenCalled();

      const props = component.mock.calls[0][0];

      expect(props.context).toBeDefined();
      expect(props.context.dataSource).toBeDefined();
      expect(props.context.dataSourceMeta).toBeDefined();
      expect(props.context.setJsonData).toBeDefined();
      expect(props.context.testingStatus).toBeDefined();
    });
  });
});
