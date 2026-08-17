import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import {
  DataSourcePicker,
  type DataSourcePickerProps,
  getDataSourcePickerError,
  setDataSourcePicker,
} from './DataSourcePicker';

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

  describe('selected option', () => {
    it('should mark the current datasource as selected when its uid differs from its name', async () => {
      const datasourceName = 'grafanacloud-demokitcloudamersandbox-prom';
      const currentUid = 'grafanacloud-prom';
      const mockDs: DataSourceInstanceSettings = {
        uid: currentUid,
        name: datasourceName,
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

      await userEvent.click(screen.getByLabelText('Select a data source'));

      // react-select marks the option matching the current value as selected. The orange-bar
      // styling is driven by this state, so asserting on aria-selected guards the regression.
      expect(screen.getByTestId('data-testid Select option')).toHaveAttribute('aria-selected', 'true');
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

  describe('data source type checks', () => {
    const prometheusDs: DataSourceInstanceSettings = {
      uid: 'prom-uid',
      name: 'Prometheus',
      type: 'prometheus',
      meta: {
        id: 'prometheus',
        name: 'Prometheus',
        type: 'datasource',
        info: {
          logos: { small: 'prom.svg', large: 'prom.svg' },
          author: { name: 'Grafana Labs' },
          description: '',
          links: [],
          screenshots: [],
          updated: '',
          version: '1.0.0',
        },
        module: '',
        baseUrl: '',
      } as DataSourcePluginMeta,
      readOnly: false,
      jsonData: {},
      access: 'proxy',
    };

    const tempoDs: DataSourceInstanceSettings = {
      ...prometheusDs,
      uid: 'tempo-uid',
      name: 'Tempo',
      type: 'tempo',
      meta: {
        ...prometheusDs.meta,
        id: 'tempo',
        name: 'Tempo',
      },
    };

    it('returns an error when the current data source type is not in the filtered list', () => {
      expect(getDataSourcePickerError('tempo-uid', tempoDs, [prometheusDs])).toBe(
        'Data source type is not valid for this field: tempo'
      );
    });

    it('returns undefined when the current data source type matches the filter', () => {
      expect(getDataSourcePickerError('prom-uid', prometheusDs, [prometheusDs])).toBeUndefined();
    });

    it('returns undefined when noDefault is set and nothing is selected', () => {
      expect(getDataSourcePickerError(null, undefined, [prometheusDs], true)).toBeUndefined();
    });

    it('returns a not-found error when the current data source cannot be resolved', () => {
      expect(getDataSourcePickerError('missing-uid', undefined, [prometheusDs])).toBe(
        'Could not find data source missing-uid'
      );
    });

    it('returns undefined for expression datasources even when they are not in the filtered list', () => {
      expect(getDataSourcePickerError('__expr__', undefined, [prometheusDs])).toBeUndefined();
    });

    it('recomputes validity on render when the allowed list changes without filter prop changes', () => {
      mockGetInstanceSettings.mockReturnValue(prometheusDs);
      mockGetList.mockReturnValue([prometheusDs]);
      const { rerender } = render(<DataSourcePicker current="prom-uid" pluginId="prometheus" onChange={jest.fn()} />);

      const wrapper = () => screen.getByLabelText('Data source picker select container').querySelector('.ds-picker');
      const validClass = wrapper()?.className;

      mockGetList.mockReturnValue([]);
      rerender(<DataSourcePicker current="prom-uid" pluginId="prometheus" onChange={jest.fn()} />);

      expect(wrapper()?.className).not.toBe(validClass);
    });
  });

  describe('setDataSourcePicker', () => {
    afterEach(() => {
      setDataSourcePicker(undefined);
    });

    it('should render the injected component with the provided props', () => {
      const InjectedPicker = jest.fn((props: DataSourcePickerProps) => <div>injected picker</div>);
      setDataSourcePicker(InjectedPicker);

      render(<DataSourcePicker onChange={jest.fn()} current="some-uid" placeholder="pick one" />);

      expect(screen.getByText('injected picker')).toBeInTheDocument();
      expect(InjectedPicker.mock.lastCall?.[0]).toMatchObject({ current: 'some-uid', placeholder: 'pick one' });
    });

    it('should render the legacy picker again after the injected component is unset', () => {
      setDataSourcePicker(() => <div>injected picker</div>);
      setDataSourcePicker(undefined);

      render(<DataSourcePicker onChange={jest.fn()} current={null} />);

      expect(screen.queryByText('injected picker')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Select a data source')).toBeInTheDocument();
    });
  });
});
