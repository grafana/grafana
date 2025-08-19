import { queryByTestId, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  GrafanaConfig,
  PluginMetaInfo,
  PluginType,
  locationUtil,
} from '@grafana/data';
import { config } from '@grafana/runtime';

import { DataSourceModal, DataSourceModalProps } from './DataSourceModal';

const pluginMetaInfo: PluginMetaInfo = {
  author: { name: '' },
  description: '',
  screenshots: [],
  version: '',
  updated: '',
  links: [],
  logos: { small: '', large: '' },
};

function createPluginMeta(name: string, builtIn: boolean): DataSourcePluginMeta {
  return { builtIn, name, id: name, type: PluginType.datasource, baseUrl: '', info: pluginMetaInfo, module: '' };
}

function createDS(name: string, id: number, builtIn: boolean): DataSourceInstanceSettings {
  return {
    name: name,
    uid: name + 'uid',
    meta: createPluginMeta(name, builtIn),
    id,
    access: 'direct',
    jsonData: {},
    type: '',
    readOnly: true,
  };
}

const mockDS1 = createDS('mock.datasource.1', 1, false);
const mockDS2 = createDS('mock.datasource.2', 2, false);
const mockDSBuiltIn = createDS('mock.datasource.builtin', 3, true);

const mockDSList = [mockDS1, mockDS2, mockDSBuiltIn];
const mockFavoriteDataSources = {
  enabled: false,
  isLoading: false,
  favoriteDatasources: [],
  initialFavoriteDataSources: [],
  isFavoriteDatasource: () => false,
  addFavoriteDatasource: () => {},
  removeFavoriteDatasource: () => {},
};
const setup = (partialProps: Partial<DataSourceModalProps> = {}) => {
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const props: DataSourceModalProps = {
    ...partialProps,
    onChange: partialProps.onChange || jest.fn(),
    onDismiss: partialProps.onDismiss || jest.fn(),
    current: partialProps.current || mockDS1,
    favoriteDataSources: partialProps.favoriteDataSources || mockFavoriteDataSources,
  };

  return render(<DataSourceModal {...props} />);
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => {
    return {
      getVariables: () => [],
    };
  },
  getDataSourceSrv: () => ({
    getList: getListMock,
    getInstanceSettings: getInstanceSettingsMock,
  }),
}));

locationUtil.initialize({
  config: { appSubUrl: '/my-sub-path' } as GrafanaConfig,
  getTimeRangeForUrl: jest.fn(),
  getVariablesUrlParams: jest.fn(),
});

const getListMock = jest.fn();
const getInstanceSettingsMock = jest.fn();
beforeEach(() => {
  getListMock.mockReturnValue(mockDSList);
  getInstanceSettingsMock.mockReturnValue(mockDS1);
});

describe('DataSourceDropdown', () => {
  it('should render', () => {
    expect(() => setup()).not.toThrow();
  });

  describe('configuration', () => {
    it('displays the configure new datasource when the list is empty', async () => {
      const user = userEvent.setup();
      setup();
      const searchBox = await screen.findByRole('searchbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);
      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(screen.queryAllByText('Configure a new data source')).toHaveLength(2);
      screen.queryAllByRole('link').forEach((link) => {
        // It should point to the new data source page including any sub url configured
        expect(link).toHaveAttribute('href', '/my-sub-path/connections/datasources/new');
      });
    });

    it('only displays the file drop area when the ff is enabled', async () => {
      const defaultValue = config.featureToggles.editPanelCSVDragAndDrop;
      config.featureToggles.editPanelCSVDragAndDrop = true;
      setup({ uploadFile: true });

      expect(await screen.queryByTestId('file-drop-zone-default-children')).toBeInTheDocument();
      config.featureToggles.editPanelCSVDragAndDrop = defaultValue;
    });

    it('does not show the file drop area when the ff is disabled', async () => {
      const defaultValue = config.featureToggles.editPanelCSVDragAndDrop;
      config.featureToggles.editPanelCSVDragAndDrop = false;

      setup({ uploadFile: true });
      expect(await screen.queryByTestId('file-drop-zone-default-children')).toBeNull();

      config.featureToggles.editPanelCSVDragAndDrop = defaultValue;
    });

    it('should not display the drop zone by default', async () => {
      const defaultValue = config.featureToggles.editPanelCSVDragAndDrop;
      config.featureToggles.editPanelCSVDragAndDrop = true;

      const component = setup();

      expect(queryByTestId(component.container, 'file-drop-zone-default-children')).toBeNull();
      config.featureToggles.editPanelCSVDragAndDrop = defaultValue;
    });

    it('should display the drop zone when uploadFile is enabled', async () => {
      const defaultValue = config.featureToggles.editPanelCSVDragAndDrop;
      config.featureToggles.editPanelCSVDragAndDrop = true;
      setup({ uploadFile: true });

      expect(await screen.queryByTestId('file-drop-zone-default-children')).toBeInTheDocument();
      config.featureToggles.editPanelCSVDragAndDrop = defaultValue;
    });

    it('should fetch the DS applying the correct filters consistently across lists', async () => {
      const filters = {
        mixed: true,
        tracing: true,
        dashboard: true,
        metrics: true,
        type: 'foo',
        annotations: true,
        variables: true,
        alerting: true,
        pluginId: 'pluginid',
        logs: true,
      };

      const props = {
        onChange: () => {},
        onDismiss: () => {},
        current: mockDS1.name,
        ...filters,
        dataSources: mockDSList,
        favoriteDataSources: mockFavoriteDataSources,
      };

      getListMock.mockClear();
      render(<DataSourceModal {...props}></DataSourceModal>);

      // Every call to the service must contain same filters
      expect(getListMock).toHaveBeenCalled();
      getListMock.mock.calls.forEach((call) =>
        expect(call[0]).toMatchObject({
          ...filters,
        })
      );
    });
  });

  describe('interactions', () => {
    it('should be searchable', async () => {
      const user = userEvent.setup();
      setup();
      const searchBox = await screen.findByRole('searchbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);

      await user.keyboard(mockDS2.name); //Search for xMockDS

      expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
      expect(await screen.findByText(mockDS2.name, { selector: 'span' })).toBeInTheDocument();

      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(await screen.findByText('No data sources found')).toBeInTheDocument();
    });

    //Skipping this test as it's flaky on drone
    it.skip('calls the onChange with the default query containing the file', async () => {
      const user = userEvent.setup();
      config.featureToggles.editPanelCSVDragAndDrop = true;
      const onChange = jest.fn();
      setup({ onChange, uploadFile: true });

      const fileInput = (
        await screen.queryByTestId('file-drop-zone-default-children')!
      ).parentElement!.parentElement!.querySelector('input');
      const file = new File([''], 'test.csv', { type: 'text/plain' });
      expect(fileInput).toBeInTheDocument();
      await user.upload(fileInput!, file);
      const defaultQuery = onChange.mock.lastCall[1][0];
      expect(defaultQuery).toMatchObject({
        refId: 'A',
        datasource: { type: 'grafana', uid: 'grafana' },
        queryType: 'snapshot',
        file: { path: 'test.csv' },
      });
      config.featureToggles.editPanelCSVDragAndDrop = false;
    });

    it('should call the onChange handler with the correct datasource', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      setup({ onChange });
      await user.click(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(onChange.mock.lastCall[0].name).toEqual(mockDS2.name);
    });
  });
});
