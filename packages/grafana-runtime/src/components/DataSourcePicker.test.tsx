import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';

import {
  DataSourcePicker,
  type DataSourcePickerProps,
  isDataSourceCompatibleWithPicker,
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

  describe('data source compatibility', () => {
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

    it('rejects a current data source that is not in the filtered list', () => {
      expect(isDataSourceCompatibleWithPicker('tempo-uid', tempoDs, [prometheusDs])).toBe(false);
    });

    it('allows a current data source that is in the filtered list', () => {
      expect(isDataSourceCompatibleWithPicker('prom-uid', prometheusDs, [prometheusDs])).toBe(true);
    });

    it('allows an empty selection', () => {
      expect(isDataSourceCompatibleWithPicker(null, undefined, [prometheusDs])).toBe(true);
      expect(isDataSourceCompatibleWithPicker(undefined, undefined, [prometheusDs])).toBe(true);
      expect(isDataSourceCompatibleWithPicker('', undefined, [prometheusDs])).toBe(true);
    });

    it('rejects a selected data source that cannot be resolved', () => {
      expect(isDataSourceCompatibleWithPicker('missing-uid', undefined, [prometheusDs])).toBe(false);
      expect(isDataSourceCompatibleWithPicker({ uid: 'missing-uid' }, undefined, [prometheusDs])).toBe(false);
    });

    it('allows expression datasources even when they are not in the filtered list', () => {
      expect(isDataSourceCompatibleWithPicker('__expr__', undefined, [prometheusDs])).toBe(true);
      expect(isDataSourceCompatibleWithPicker({ uid: '__expr__' }, undefined, [prometheusDs])).toBe(true);
    });

    it('allows template datasource refs that resolved via rawRef even when the variable uid is not in the list', () => {
      const variableSettings: DataSourceInstanceSettings = {
        ...prometheusDs,
        uid: '${ds}',
        name: '${ds}',
        rawRef: { type: 'prometheus', uid: 'prom-uid' },
      };
      expect(isDataSourceCompatibleWithPicker('${ds}', variableSettings, [prometheusDs])).toBe(true);
      expect(isDataSourceCompatibleWithPicker('$ds', { ...variableSettings, uid: '$ds', name: '$ds' }, [prometheusDs])).toBe(
        true
      );
      expect(
        isDataSourceCompatibleWithPicker('${rowDs}', { ...variableSettings, uid: '${rowDs}', name: '${rowDs}' }, [
          prometheusDs,
        ])
      ).toBe(true);
    });

    it('rejects an unresolved template datasource ref', () => {
      expect(isDataSourceCompatibleWithPicker('${missing}', undefined, [prometheusDs])).toBe(false);
    });

    it('rejects a template datasource ref whose interpolated datasource is not in the filtered list', () => {
      const variableSettings: DataSourceInstanceSettings = {
        ...tempoDs,
        uid: '${ds}',
        name: '${ds}',
        rawRef: { type: 'tempo', uid: 'tempo-uid' },
      };
      expect(isDataSourceCompatibleWithPicker('${ds}', variableSettings, [prometheusDs])).toBe(false);
    });

    it('marks the select invalid when the current data source is not in the filtered list', () => {
      mockGetInstanceSettings.mockReturnValue(tempoDs);
      mockGetList.mockReturnValue([prometheusDs]);
      render(<DataSourcePicker current="tempo-uid" pluginId="prometheus" onChange={jest.fn()} />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not mark the select invalid when the current data source matches the filter', () => {
      mockGetInstanceSettings.mockReturnValue(prometheusDs);
      mockGetList.mockReturnValue([prometheusDs]);
      render(<DataSourcePicker current="prom-uid" pluginId="prometheus" onChange={jest.fn()} />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');
    });

    it('recomputes validity on render when the allowed list changes without filter prop changes', () => {
      mockGetInstanceSettings.mockReturnValue(prometheusDs);
      mockGetList.mockReturnValue([prometheusDs]);
      const { rerender } = render(<DataSourcePicker current="prom-uid" pluginId="prometheus" onChange={jest.fn()} />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');

      mockGetList.mockReturnValue([]);
      rerender(<DataSourcePicker current="prom-uid" pluginId="prometheus" onChange={jest.fn()} />);

      expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
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
