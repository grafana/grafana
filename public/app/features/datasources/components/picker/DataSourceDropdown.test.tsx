import { findByText, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserEvent } from '@testing-library/user-event/dist/types/setup/setup';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import config from 'app/core/config';
import { defaultFileUploadQuery } from 'app/plugins/datasource/grafana/types';

import { DataSourceDropdown, DataSourceDropdownProps } from './DataSourceDropdown';
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

async function setupOpenDropdown(user: UserEvent, props: DataSourceDropdownProps) {
  const dropdown = render(<DataSourceDropdown {...props}></DataSourceDropdown>);
  const searchBox = dropdown.container.querySelector('input');
  expect(searchBox).toBeInTheDocument();
  await user.click(searchBox!);
}

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => {
      return {
        getVariables: () => [{ id: 'foo', type: 'datasource' }],
      };
    },
  };
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      getList: getListMock,
      getInstanceSettings: getInstanceSettingsMock,
    }),
  };
});

const pushRecentlyUsedDataSourceMock = jest.fn();
jest.mock('../../hooks', () => {
  const actual = jest.requireActual('../../hooks');
  return {
    ...actual,
    useRecentlyUsedDataSources: () => [[mockDS2.name], pushRecentlyUsedDataSourceMock],
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

describe('DataSourceDropdown', () => {
  it('should render', () => {
    expect(() => render(<DataSourceDropdown onChange={jest.fn()}></DataSourceDropdown>)).not.toThrow();
  });

  describe('configuration', () => {
    const user = userEvent.setup();

    it('should call the dataSourceSrv.getDatasourceList with the correct filters', async () => {
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
      const dropdown = render(<DataSourceDropdown {...props}></DataSourceDropdown>);

      const searchBox = dropdown.container.querySelector('input');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);
      expect(getListMock.mock.lastCall[0]).toEqual(filters);
    });

    it('should dispaly the current selected DS in the selector', async () => {
      getInstanceSettingsMock.mockReturnValue(mockDS2);
      render(<DataSourceDropdown onChange={jest.fn()} current={mockDS2}></DataSourceDropdown>);
      expect(screen.getByTestId('Select a data source')).toHaveAttribute('placeholder', mockDS2.name);
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

    it('should dispaly the default DS as selected when `current` is not set', async () => {
      getInstanceSettingsMock.mockReturnValue(mockDS2);
      render(<DataSourceDropdown onChange={jest.fn()} current={undefined}></DataSourceDropdown>);
      expect(screen.getByTestId('Select a data source')).toHaveAttribute('placeholder', mockDS2.name);
      expect(screen.getByAltText(`${mockDS2.meta.name} logo`)).toBeVisible();
    });

    it('should get the sorting function using the correct parameters', async () => {
      //The actual sorting is tested in utils.test but let's make sure we're calling getDataSourceCompareFn with the correct parameters
      const spy = jest.spyOn(utils, 'getDataSourceCompareFn');
      await setupOpenDropdown(user, { onChange: jest.fn(), current: mockDS1 });

      expect(spy.mock.lastCall).toEqual([mockDS1, [mockDS2.name], ['${foo}']]);
    });

    it('should disable the dropdown when `disabled` is true', () => {
      render(<DataSourceDropdown onChange={jest.fn()} disabled></DataSourceDropdown>);
      expect(screen.getByTestId('Select a data source')).toBeDisabled();
    });

    it('should assign the correct `id` to the input element to pair it with a label', () => {
      render(<DataSourceDropdown onChange={jest.fn()} inputId={'custom.input.id'}></DataSourceDropdown>);
      expect(screen.getByTestId('Select a data source')).toHaveAttribute('id', 'custom.input.id');
    });

    it('should not set the default DS when setting `noDefault` to true and `current` is not provided', () => {
      render(<DataSourceDropdown onChange={jest.fn()} current={null} noDefault></DataSourceDropdown>);
      getListMock.mockClear();
      getInstanceSettingsMock.mockClear();
      // Doesn't try to get the default DS
      expect(getListMock).not.toBeCalled();
      expect(getInstanceSettingsMock).not.toBeCalled();
      expect(screen.getByTestId('Select a data source')).toHaveAttribute('placeholder', 'Select a data source');
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
    });

    it('should call onChange with the default query when add csv is clicked', async () => {
      config.featureToggles.editPanelCSVDragAndDrop = true;
      const onChange = jest.fn();
      await setupOpenDropdown(user, { onChange });

      await user.click(await screen.findByText('Add csv or spreadsheet'));

      expect(onChange.mock.lastCall[1]).toEqual([defaultFileUploadQuery]);
      expect(screen.queryByText('Open advanced data source picker')).toBeNull(); //Drop down is closed
      config.featureToggles.editPanelCSVDragAndDrop = false;
    });

    it('should open the modal when open advanced is clicked', async () => {
      const props = { onChange: jest.fn(), current: mockDS1.name };
      render(
        <ModalsProvider>
          <DataSourceDropdown {...props}></DataSourceDropdown>
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
