import { findByText, render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';

import {
  DataSourceInstanceSettings,
  DataSourcePluginMeta,
  GrafanaConfig,
  PluginMetaInfo,
  PluginType,
  locationUtil,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import config from 'app/core/config';
import { defaultFileUploadQuery } from 'app/plugins/datasource/grafana/types';

import { DataSourcePicker, DataSourcePickerProps } from './DataSourcePicker';
import * as utils from './utils';

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
const MockDSBuiltIn = createDS('mock.datasource.builtin', 3, true);

const mockDSList = [mockDS1, mockDS2, MockDSBuiltIn];

async function setupOpenDropdown(user: UserEvent, props: DataSourcePickerProps) {
  const dropdown = render(<DataSourcePicker {...props}></DataSourcePicker>);
  const searchBox = dropdown.container.querySelector('input');
  expect(searchBox).toBeInTheDocument();
  await user.click(searchBox!);
}

locationUtil.initialize({
  config: { appSubUrl: '/my-sub-path' } as GrafanaConfig,
  getVariablesUrlParams: jest.fn(),
  getTimeRangeForUrl: jest.fn(),
});

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => {
    return {
      getVariables: () => [{ id: 'foo', type: 'datasource' }],
    };
  },
  getDataSourceSrv: () => ({
    getList: getListMock,
    getInstanceSettings: getInstanceSettingsMock,
  }),
  useFavoriteDatasources: () => ({
    enabled: false,
    isLoading: false,
    favoriteDatasources: [],
    initialFavoriteDataSources: [],
    addFavoriteDatasource: jest.fn(),
    removeFavoriteDatasource: jest.fn(),
    isFavoriteDatasource: jest.fn(() => false),
  }),
}));

const pushRecentlyUsedDataSourceMock = jest.fn();
jest.mock('../../hooks', () => {
  const actual = jest.requireActual('../../hooks');
  return {
    ...actual,
    useRecentlyUsedDataSources: () => [[mockDS2.name], pushRecentlyUsedDataSourceMock],
    useDatasources: () => mockDSList,
  };
});

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const getListMock = jest.fn();
const getInstanceSettingsMock = jest.fn();
beforeEach(() => {
  getListMock.mockReturnValue(mockDSList);
  getInstanceSettingsMock.mockReturnValue(mockDS1);
});

describe('DataSourcePicker', () => {
  it('should render', () => {
    expect(() => render(<DataSourcePicker onChange={jest.fn()}></DataSourcePicker>)).not.toThrow();
  });

  describe('configuration', () => {
    const user = userEvent.setup();

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
        current: mockDS1.name,
        ...filters,
      };

      render(
        <ModalsProvider>
          <DataSourcePicker {...props}></DataSourcePicker>
          <ModalRoot />
        </ModalsProvider>
      );

      const searchBox = await screen.findByRole('textbox');
      expect(searchBox).toBeInTheDocument();

      getListMock.mockClear();
      await user.click(searchBox!);
      await user.click(await screen.findByText('Open advanced data source picker'));
      expect(await screen.findByText('Select data source')); //Data source modal is open
      // Every call to the service must contain same filters
      getListMock.mock.calls.forEach((call) =>
        expect(call[0]).toMatchObject({
          ...filters,
        })
      );
    });

    it('should display the current selected DS in the selector', async () => {
      getInstanceSettingsMock.mockReturnValue(mockDS2);
      render(<DataSourcePicker onChange={jest.fn()} current={mockDS2}></DataSourcePicker>);
      expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute(
        'placeholder',
        mockDS2.name
      );
      expect(screen.getByAltText(`${mockDS2.meta.name} logo`)).toBeVisible();
    });

    it('should display the current ds on top', async () => {
      //Mock ds is set as current, it appears on top
      getInstanceSettingsMock.mockReturnValue(mockDS1);
      await setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS1.name });
      let cards = await screen.findAllByTestId('data-source-card');
      expect(await findByText(cards[0], mockDS1.name, { selector: 'span' })).toBeInTheDocument();

      //xMock ds is set as current, it appears on top
      getInstanceSettingsMock.mockReturnValue(mockDS2);
      await setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS2.name });
      cards = await screen.findAllByTestId('data-source-card');
      expect(await findByText(cards[0], mockDS2.name, { selector: 'span' })).toBeInTheDocument();
    });

    it('should display the default DS as selected when `current` is not set', async () => {
      getInstanceSettingsMock.mockReturnValue(mockDS2);
      render(<DataSourcePicker onChange={jest.fn()} current={undefined}></DataSourcePicker>);
      expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute(
        'placeholder',
        mockDS2.name
      );
      expect(screen.getByAltText(`${mockDS2.meta.name} logo`)).toBeVisible();
    });

    it('should get the sorting function using the correct parameters', async () => {
      //The actual sorting is tested in utils.test but let's make sure we're calling getDataSourceCompareFn with the correct parameters
      const spy = jest.spyOn(utils, 'getDataSourceCompareFn');
      await setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS1 });

      expect(spy.mock.lastCall).toEqual([mockDS1, [mockDS2.name], ['${foo}']]);
    });

    it('should disable the dropdown when `disabled` is true', () => {
      render(<DataSourcePicker onChange={jest.fn()} disabled></DataSourcePicker>);
      expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toBeDisabled();
    });

    it('should assign the correct `id` to the input element to pair it with a label', () => {
      render(<DataSourcePicker onChange={jest.fn()} inputId={'custom.input.id'}></DataSourcePicker>);
      expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute(
        'id',
        'custom.input.id'
      );
    });

    it('should not set the default DS when setting `noDefault` to true and `current` is not provided', () => {
      render(<DataSourcePicker onChange={jest.fn()} current={null} noDefault></DataSourcePicker>);
      getListMock.mockClear();
      getInstanceSettingsMock.mockClear();
      // Doesn't try to get the default DS
      expect(getListMock).not.toBeCalled();
      expect(getInstanceSettingsMock).not.toBeCalled();
      expect(screen.getByTestId(selectors.components.DataSourcePicker.inputV2)).toHaveAttribute(
        'placeholder',
        'Select data source'
      );
    });
  });

  describe('interactions', () => {
    const user = userEvent.setup();

    it('should open when clicked', async () => {
      await setupOpenDropdown(user, { onChange: jest.fn() });
      expect(await screen.findByText(mockDS1.name, { selector: 'span' })).toBeInTheDocument();
    });

    it('should call onChange when a data source is clicked', async () => {
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange });

      await user.click(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(onChange.mock.lastCall[0]['name']).toEqual(mockDS2.name);
      expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
    });

    it('should not call onChange when the currently selected data source is clicked', async () => {
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange });

      await user.click(await screen.findByText(mockDS1.name, { selector: 'span' }));
      expect(onChange).not.toBeCalled();
    });

    it('should push recently used datasources when a data source is clicked', async () => {
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange });

      await user.click(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(pushRecentlyUsedDataSourceMock.mock.lastCall[0]).toEqual(mockDS2);
    });

    it('should be navigatable by keyboard', async () => {
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange });

      await user.keyboard('[ArrowDown]');
      //Arrow down, second item is selected
      const xMockDSElement = getCard(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(xMockDSElement?.dataset.selecteditem).toEqual('true');
      let mockDSElement = getCard(await screen.findByText(mockDS1.name, { selector: 'span' }));
      expect(mockDSElement?.dataset.selecteditem).toEqual('false');

      await user.keyboard('[ArrowUp]');
      //Arrow up, first item is selected again
      mockDSElement = getCard(await screen.findByText(mockDS1.name, { selector: 'span' }));
      expect(mockDSElement?.dataset.selecteditem).toEqual('true');

      await user.keyboard('[ArrowDown]');
      await user.keyboard('[Enter]');
      //Arrow down to navigate to xMock, enter to select it. Assert onChange called with correct DS and dropdown closed.
      expect(onChange.mock.lastCall[0]['name']).toEqual(mockDS2.name);
      expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
    });

    it('should be searchable', async () => {
      await setupOpenDropdown(user, { onChange: jest.fn() });

      await user.keyboard(mockDS2.name); //Search for xMockDS

      expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
      const xMockCard = getCard(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(xMockCard).toBeInTheDocument();

      expect(xMockCard?.dataset.selecteditem).toEqual('true'); //The first search result is selected

      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(await screen.findByText('Configure a new data source')).toBeInTheDocument();
      // It should point to the new data source page including any sub url configured
      expect(screen.getByRole('link')).toHaveAttribute('href', '/my-sub-path/connections/datasources/new');
    });

    it('should call onChange with the default query when add csv is clicked', async () => {
      config.featureToggles.editPanelCSVDragAndDrop = true;
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange, uploadFile: true });

      await user.click(await screen.findByText('Add csv or spreadsheet'));

      expect(onChange.mock.lastCall[1]).toEqual([defaultFileUploadQuery]);
      expect(screen.queryByText('Open advanced data source picker')).toBeNull(); //Drop down is closed
      config.featureToggles.editPanelCSVDragAndDrop = false;
    });

    it('should open the modal when open advanced is clicked', async () => {
      const props = { onChange: jest.fn(), current: mockDS1.name };
      render(
        <ModalsProvider>
          <DataSourcePicker {...props}></DataSourcePicker>
          <ModalRoot />
        </ModalsProvider>
      );

      const searchBox = await screen.findByRole('textbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);
      await user.click(await screen.findByText('Open advanced data source picker'));
      expect(await screen.findByText('Select data source')); //Data source modal is open
      expect(screen.queryByText('Open advanced data source picker')).toBeNull(); //Drop down is closed
    });
  });
});

function getCard(element: HTMLElement) {
  return element.parentElement?.parentElement?.parentElement?.parentElement;
}
