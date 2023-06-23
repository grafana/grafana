import { findByText, queryByText, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DataSourceInstanceSettings, DataSourcePluginMeta, PluginMetaInfo, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';

import { DataSourceModal } from './DataSourceModal';

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

const setup = (onChange = () => {}, onDismiss = () => {}) => {
  const props = { onChange, onDismiss, current: mockDS1.name };
  window.HTMLElement.prototype.scrollIntoView = function () {};
  return render(<DataSourceModal {...props}></DataSourceModal>);
};

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    getTemplateSrv: () => {
      return {
        getVariables: () => [],
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
    const user = userEvent.setup();
    it('displays the configure new datasource when the list is empty', async () => {
      setup();
      const searchBox = await screen.findByRole('searchbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);
      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(screen.queryAllByText('Configure a new data source')).toHaveLength(2);
    });

    it('only displays the file drop area when the the ff is enabled', async () => {
      config.featureToggles.editPanelCSVDragAndDrop = true;
      setup();
      expect(await screen.findByText('Drop file here or click to upload')).toBeInTheDocument();
      config.featureToggles.editPanelCSVDragAndDrop = false;
    });

    it('does not show the file drop area when the ff is disabled', async () => {
      setup();
      expect(screen.queryByText('Drop file here or click to upload')).toBeNull();
    });

    it('should only display built in datasources in the right column', async () => {
      setup();
      const dsList = await screen.findByTestId('data-sources-list');
      const builtInDSList = (await screen.findAllByTestId('built-in-data-sources-list'))[1]; //The second element needs to be selected as the first element is the one on the left, under the regular data sources.

      expect(queryByText(dsList, mockDSBuiltIn.name)).toBeNull();
      expect(await findByText(builtInDSList, mockDSBuiltIn.name, { selector: 'span' })).toBeInTheDocument();
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
    const user = userEvent.setup();

    it('should be searchable', async () => {
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

    it('calls the onChange with the default query containing the file', async () => {
      config.featureToggles.editPanelCSVDragAndDrop = true;
      const onChange = jest.fn();
      setup(onChange);
      const fileInput = (
        await screen.findByText('Drop file here or click to upload')
      ).parentElement!.parentElement!.querySelector('input');
      const file = new File([''], 'test.csv', { type: 'text/plain' });
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
      const onChange = jest.fn();
      setup(onChange);
      await user.click(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(onChange.mock.lastCall[0].name).toEqual(mockDS2.name);
    });
  });
});
