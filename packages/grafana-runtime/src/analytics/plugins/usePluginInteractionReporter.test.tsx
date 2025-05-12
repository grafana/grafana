import { renderHook } from '@testing-library/react';
import * as React from 'react';

import {
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  PluginContextProvider,
  PluginMeta,
  PluginMetaInfo,
  PluginSignatureStatus,
  PluginType,
} from '@grafana/data';
import iconGaugeSvg from 'app/plugins/panel/gauge/img/icon_gauge.svg';

import { reportInteraction } from '../utils';

import { usePluginInteractionReporter } from './usePluginInteractionReporter';

jest.mock('../utils', () => ({ reportInteraction: jest.fn() }));
const reportInteractionMock = jest.mocked(reportInteraction);

describe('usePluginInteractionReporter', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('within a panel plugin', () => {
    it('should report interaction with plugin context info for internal panel', () => {
      const report = renderPluginReporterHook({
        id: 'gauge',
        name: 'Gauge',
        type: PluginType.panel,
        info: createPluginMetaInfo({
          version: '',
        }),
      });

      report('grafana_plugin_gradient_mode_changed');

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_gradient_mode_changed');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'panel',
        plugin_version: '',
        plugin_id: 'gauge',
        plugin_name: 'Gauge',
      });
    });

    it('should report interaction with plugin context info for external panel', () => {
      const report = renderPluginReporterHook({
        id: 'grafana-clock-panel',
        name: 'Clock',
        type: PluginType.panel,
        info: createPluginMetaInfo({
          version: '2.1.0',
        }),
      });

      report('grafana_plugin_time_zone_changed');

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_time_zone_changed');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'panel',
        plugin_version: '2.1.0',
        plugin_id: 'grafana-clock-panel',
        plugin_name: 'Clock',
      });
    });

    it('should report interaction with plugin context info and extra info provided when reporting', () => {
      const report = renderPluginReporterHook({
        id: 'grafana-clock-panel',
        name: 'Clock',
        type: PluginType.panel,
        info: createPluginMetaInfo({
          version: '2.1.0',
        }),
      });

      report('grafana_plugin_time_zone_changed', {
        time_zone: 'Europe/Stockholm',
      });

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_time_zone_changed');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'panel',
        plugin_version: '2.1.0',
        plugin_id: 'grafana-clock-panel',
        plugin_name: 'Clock',
        time_zone: 'Europe/Stockholm',
      });
    });
  });

  describe('within a data source plugin', () => {
    it('should report interaction with plugin context info for internal data source', () => {
      const report = renderDataSourcePluginReporterHook({
        uid: 'qeSI8VV7z',
        meta: createPluginMeta({
          id: 'prometheus',
          name: 'Prometheus',
          type: PluginType.datasource,
          info: createPluginMetaInfo({
            version: '',
          }),
        }),
      });

      report('grafana_plugin_query_mode_changed');

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_query_mode_changed');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'datasource',
        plugin_version: '',
        plugin_id: 'prometheus',
        plugin_name: 'Prometheus',
        datasource_uid: 'qeSI8VV7z',
      });
    });

    it('should report interaction with plugin context info for external data source', () => {
      const report = renderDataSourcePluginReporterHook({
        uid: 'PD8C576611E62080A',
        meta: createPluginMeta({
          id: 'grafana-github-datasource',
          name: 'GitHub',
          type: PluginType.datasource,
          info: createPluginMetaInfo({
            version: '1.2.0',
          }),
        }),
      });

      report('grafana_plugin_repository_selected');

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_repository_selected');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'datasource',
        plugin_version: '1.2.0',
        plugin_id: 'grafana-github-datasource',
        plugin_name: 'GitHub',
        datasource_uid: 'PD8C576611E62080A',
      });
    });

    it('should report interaction with plugin context info and extra info provided when reporting', () => {
      const report = renderDataSourcePluginReporterHook({
        uid: 'PD8C576611E62080A',
        meta: createPluginMeta({
          id: 'grafana-github-datasource',
          name: 'GitHub',
          type: PluginType.datasource,
          info: createPluginMetaInfo({
            version: '1.2.0',
          }),
        }),
      });

      report('grafana_plugin_repository_selected', {
        repository: 'grafana/grafana',
      });

      const [args] = reportInteractionMock.mock.calls;
      const [interactionName, properties] = args;

      expect(reportInteractionMock.mock.calls.length).toBe(1);
      expect(interactionName).toBe('grafana_plugin_repository_selected');
      expect(properties).toEqual({
        grafana_version: '1.0',
        plugin_type: 'datasource',
        plugin_version: '1.2.0',
        plugin_id: 'grafana-github-datasource',
        plugin_name: 'GitHub',
        datasource_uid: 'PD8C576611E62080A',
        repository: 'grafana/grafana',
      });
    });
  });

  describe('ensure interaction name follows convention', () => {
    it('should throw name does not start with "grafana_plugin_"', () => {
      const report = renderDataSourcePluginReporterHook();
      expect(() => report('select_query_type')).toThrow();
    });

    it('should throw if name is exactly "grafana_plugin_"', () => {
      const report = renderPluginReporterHook();
      expect(() => report('grafana_plugin_')).toThrow();
    });
  });
});

function renderPluginReporterHook(meta?: Partial<PluginMeta>): typeof reportInteraction {
  const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
    <PluginContextProvider meta={createPluginMeta(meta)}>{children}</PluginContextProvider>
  );
  const { result } = renderHook(() => usePluginInteractionReporter(), { wrapper });
  return result.current;
}

function renderDataSourcePluginReporterHook(settings?: Partial<DataSourceInstanceSettings>): typeof reportInteraction {
  const wrapper = ({ children }: React.PropsWithChildren<{}>) => (
    <DataSourcePluginContextProvider instanceSettings={createDataSourceInstanceSettings(settings)}>
      {children}
    </DataSourcePluginContextProvider>
  );
  const { result } = renderHook(() => usePluginInteractionReporter(), { wrapper });
  return result.current;
}

function createPluginMeta(meta: Partial<PluginMeta> = {}): PluginMeta {
  return {
    id: 'gauge',
    name: 'Gauge',
    type: PluginType.panel,
    info: createPluginMetaInfo(),
    module: 'app/plugins/panel/gauge/module',
    baseUrl: '',
    signature: PluginSignatureStatus.internal,
    ...meta,
  };
}

function createPluginMetaInfo(info: Partial<PluginMetaInfo> = {}): PluginMetaInfo {
  return {
    author: { name: 'Grafana Labs' },
    description: 'Standard gauge visualization',
    links: [],
    logos: {
      large: iconGaugeSvg,
      small: iconGaugeSvg,
    },
    screenshots: [],
    updated: '',
    version: '',
    ...info,
  };
}

function createDataSourceInstanceSettings(
  settings: Partial<DataSourceInstanceSettings> = {}
): DataSourceInstanceSettings {
  const { meta, ...rest } = settings;

  return {
    id: 1,
    uid: '',
    name: '',
    meta: createPluginMeta(meta),
    type: PluginType.datasource,
    readOnly: false,
    jsonData: {},
    access: 'proxy',
    ...rest,
  };
}
