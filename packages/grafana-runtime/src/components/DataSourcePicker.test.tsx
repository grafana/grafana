import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataSourceInstanceSettings, DataSourcePluginMeta } from '@grafana/data';

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
      const mockDs: DataSourceInstanceSettings = {
        uid: currentUid,
        name: longDatasourceName,
        type: 'prometheus',
        meta: {
          id: 'prometheus',
          name: 'Prometheus',
          type: 'datasource',
          info: {
            logos: {
              small: 'prometheus_logo.svg',
              large: 'prometheus_logo.svg',
            },
            author: { name: 'Grafana Labs' },
            description: 'Prometheus data source',
            links: [],
            screenshots: [],
            updated: '2021-01-01',
            version: '1.0.0',
          },
          module: 'core:plugin/prometheus',
          baseUrl: '',
        } as DataSourcePluginMeta,
        readOnly: false,
        jsonData: {},
        access: 'proxy',
      };

      mockGetInstanceSettings.mockReturnValue(mockDs);
      mockGetList.mockReturnValue([mockDs]);

      render(<DataSourcePicker current={currentUid} onChange={jest.fn()} />);

      // The full name should be visible in the select value
      expect(screen.getByText(longDatasourceName)).toBeInTheDocument();
    });
  });

  describe('onClear', () => {
    it('should call onClear when function is passed', async () => {
      const onClear = jest.fn();
      const select = render(<DataSourcePicker onClear={onClear} />);

      const clearButton = select.getByLabelText('Clear value');
      await userEvent.click(clearButton);
      expect(onClear).toHaveBeenCalled();
    });

    it('should not render clear button when no onClear function is passed', async () => {
      const select = render(<DataSourcePicker />);

      expect(() => {
        select.getByLabelText('Clear value');
      }).toThrowError();
    });

    it('should pass disabled prop', async () => {
      render(<DataSourcePicker disabled={true} />);

      const input = screen.getByLabelText('Select a data source');
      expect(input).toHaveProperty('disabled', true);
    });
  });
});
