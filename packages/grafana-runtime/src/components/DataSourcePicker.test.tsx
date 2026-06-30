import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import { DataSourcePicker } from './DataSourcePicker';

const mockGetInstanceSettings = jest.fn();
const mockGetList = jest.fn();

jest.mock('../services/dataSourceSrv', () => ({
  getDataSourceSrv: () => ({
    getList: mockGetList,
    getInstanceSettings: mockGetInstanceSettings,
    get: () => undefined,
  }),
}));

function createDataSource(name: string, uid: string, type: string): DataSourceInstanceSettings {
  return {
    uid,
    name,
    type,
    meta: {
      id: type,
      name: type,
      type: 'datasource',
      info: {
        logos: {
          small: `${type}_logo.svg`,
          large: `${type}_logo.svg`,
        },
        author: { name: 'Grafana Labs' },
        description: `${type} data source`,
        links: [],
        screenshots: [],
        updated: '2021-01-01',
        version: '1.0.0',
      },
      module: `core:plugin/${type}`,
      baseUrl: '',
    } as DataSourcePluginMeta,
    readOnly: false,
    jsonData: {},
    access: 'proxy',
  };
}

describe('DataSourcePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetList.mockReturnValue([]);
    mockGetInstanceSettings.mockReturnValue(undefined);
  });

  describe('long datasource names', () => {
    it('should display full datasource name without truncation when current is passed as UID', () => {
      const longDatasourceName = 'grafanacloud-demokitcloudamersandbox-prom';
      const currentUid = 'grafanacloud-prom';
      const mockDs = createDataSource(longDatasourceName, currentUid, 'prometheus');

      mockGetInstanceSettings.mockReturnValue(mockDs);
      mockGetList.mockReturnValue([mockDs]);

      render(<DataSourcePicker current={currentUid} onChange={jest.fn()} />);

      // The full name should be visible in the select value
      expect(screen.getByText(longDatasourceName)).toBeInTheDocument();
    });
  });

  describe('current data source validation', () => {
    it('should not display a current data source that is excluded by the picker filter as valid', () => {
      const tempoDs = createDataSource('tempo', 'tempo-uid', 'tempo');
      const prometheusDs = createDataSource('prometheus', 'prometheus-uid', 'prometheus');

      mockGetInstanceSettings.mockReturnValue(tempoDs);
      mockGetList.mockReturnValue([prometheusDs]);

      render(
        <DataSourcePicker
          current={tempoDs.uid}
          onChange={jest.fn()}
          filter={(dataSource) => dataSource.type === 'prometheus'}
        />
      );

      expect(screen.queryByText('tempo')).not.toBeInTheDocument();
      expect(screen.getByText('tempo-uid - invalid')).toBeInTheDocument();
    });
  });

  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onChange={jest.fn()} current={null} onClear={onClear} />);

      const clearButton = select.getByLabelText('Clear value');
      await userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker onChange={jest.fn()} current={null} />);

      expect(() => {
        select.getByLabelText('Clear value');
      }).toThrowError();
    });

    it('should pass disabled prop', async () => {
      render(<DataSourcePicker onChange={jest.fn()} current={null} disabled={true} />);

      const input = screen.getByLabelText('Select a data source');
      expect(input).toHaveProperty('disabled', true);
    });
  });
});
