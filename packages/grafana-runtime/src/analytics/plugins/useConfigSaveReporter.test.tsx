import { act, renderHook } from '@testing-library/react';
import * as React from 'react';

import {
  DataSourceInstanceSettings,
  DataSourcePluginContextProvider,
  DataSourceTestFailed,
  DataSourceTestSucceeded,
  EventBusSrv,
  PluginMeta,
  PluginMetaInfo,
  PluginSignatureStatus,
  PluginType,
} from '@grafana/data';
import iconGaugeSvg from 'app/plugins/panel/gauge/img/icon_gauge.svg';

import { ConfigSaveReporterProperties, useConfigSaveReporter } from './useConfigSaveReporter';

const testEventBus = new EventBusSrv();

const mockReport = jest.fn();
jest.mock('./usePluginInteractionReporter', () => ({ usePluginInteractionReporter: () => mockReport }));
jest.mock('../../services', () => ({ ...jest.requireActual('../../services'), getAppEvents: () => testEventBus }));

describe('useConfigSaveReporter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('reports grafana_plugin_save_result with result success when DataSourceTestSucceeded is published', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper(),
    });

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'success', auth_type: 'default' })
    );
  });

  it('reports grafana_plugin_save_result with result error when DataSourceTestFailed is published', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper(),
    });

    act(() => {
      testEventBus.publish(new DataSourceTestFailed());
    });

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'error', auth_type: 'default' })
    );
  });

  it('works within a DataSourcePluginContextProvider', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })), {
      wrapper: createWrapper({
        uid: 'abc123',
        meta: createPluginMeta({
          id: 'grafana-cloudwatch-datasource',
          name: 'CloudWatch',
          info: createPluginMetaInfo({ version: '1.0.0' }),
        }),
      }),
    });

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'success', auth_type: 'default' })
    );
  });

  it('works with no getProperties argument', () => {
    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource'), {
      wrapper: createWrapper(),
    });

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ plugin_id: 'grafana-cloudwatch-datasource', result: 'success' })
    );
  });

  it('forwards arbitrary extra properties to the interaction event', () => {
    renderHook(
      () =>
        useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default', custom_prop: 'value' })),
      { wrapper: createWrapper() }
    );

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ auth_type: 'default', custom_prop: 'value' })
    );
  });

  it('stops reporting after unmount', () => {
    const { unmount } = renderHook(
      () => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: 'default' })),
      { wrapper: createWrapper() }
    );

    unmount();

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
      testEventBus.publish(new DataSourceTestFailed());
    });

    expect(mockReport).not.toHaveBeenCalled();
  });

  it('uses the current properties at event time, not at subscription time', () => {
    let authType = 'default';

    renderHook(() => useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: authType })), {
      wrapper: createWrapper(),
    });

    authType = 'keys';

    act(() => {
      testEventBus.publish(new DataSourceTestSucceeded());
    });

    expect(mockReport).toHaveBeenCalledWith(
      'grafana_plugin_save_result',
      expect.objectContaining({ auth_type: 'keys' })
    );
  });

  it('does not recreate subscriptions when re-rendered with a new getProperties function reference', () => {
    const { rerender } = renderHook(
      ({ authType }: { authType: string }) =>
        useConfigSaveReporter('grafana-cloudwatch-datasource', () => ({ auth_type: authType })),
      { wrapper: createWrapper(), initialProps: { authType: 'default' } }
    );

    const subscribeSpy = jest.spyOn(testEventBus, 'subscribe');
    rerender({ authType: 'default' });

    expect(subscribeSpy).not.toHaveBeenCalled();
    subscribeSpy.mockRestore();
  });
});

describe('ConfigSaveReporterProperties', () => {
  it('accepts string values', () => {
    const properties: ConfigSaveReporterProperties = {
      auth_type: 'keys',
      region: 'us-east-1',
    };
    expect(properties).toBeDefined();
  });

  it('rejects number values', () => {
    const properties: ConfigSaveReporterProperties = {
      // @ts-expect-error number values are not allowed
      retry_count: 3,
    };
    expect(properties).toBeDefined();
  });

  it('rejects boolean values', () => {
    const properties: ConfigSaveReporterProperties = {
      // @ts-expect-error boolean values are not allowed
      tls_enabled: true,
    };
    expect(properties).toBeDefined();
  });

  it('rejects object values', () => {
    const properties: ConfigSaveReporterProperties = {
      // @ts-expect-error object values are not allowed — they may contain nested sensitive data
      credentials: { key: 'secret' },
    };
    expect(properties).toBeDefined();
  });

  it('rejects array values', () => {
    const properties: ConfigSaveReporterProperties = {
      // @ts-expect-error array values are not allowed
      regions: ['us-east-1', 'eu-west-1'],
    };
    expect(properties).toBeDefined();
  });

  it('rejects null values', () => {
    const properties: ConfigSaveReporterProperties = {
      // @ts-expect-error null is not allowed
      auth_type: null,
    };
    expect(properties).toBeDefined();
  });
});

function createWrapper(settings?: Partial<DataSourceInstanceSettings>) {
  const instanceSettings = createDataSourceInstanceSettings(settings);
  return ({ children }: React.PropsWithChildren<{}>) => (
    <DataSourcePluginContextProvider instanceSettings={instanceSettings}>{children}</DataSourcePluginContextProvider>
  );
}

function createDataSourceInstanceSettings(
  settings: Partial<DataSourceInstanceSettings> = {}
): DataSourceInstanceSettings {
  const { meta, ...rest } = settings;
  return {
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

function createPluginMeta(meta: Partial<PluginMeta> = {}): PluginMeta {
  return {
    id: 'grafana-cloudwatch-datasource',
    name: 'CloudWatch',
    type: PluginType.datasource,
    info: createPluginMetaInfo(),
    module: 'app/plugins/datasource/cloudwatch/module',
    baseUrl: '',
    signature: PluginSignatureStatus.internal,
    ...meta,
  };
}

function createPluginMetaInfo(info: Partial<PluginMetaInfo> = {}): PluginMetaInfo {
  return {
    author: { name: 'Grafana Labs' },
    description: '',
    links: [],
    logos: { large: iconGaugeSvg, small: iconGaugeSvg },
    screenshots: [],
    updated: '',
    version: '',
    ...info,
  };
}
