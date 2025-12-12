import { renderHook, waitFor } from '@testing-library/react';

import { setAppPluginMetas } from '@grafana/runtime/internal';
import { pluginMeta, pluginMetaToPluginConfig } from 'app/features/alerting/unified/testSetup/plugins';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { useIrmConfig } from './irmHooks';

describe('useIrmConfig', () => {
  it('should return default values during load', async () => {
    const { result } = renderHook(() => useIrmConfig());

    expect(result.current.isIrmConfigLoading).toBe(true);
    expect(result.current.irmConfig).toEqual({
      isIrmPluginPresent: false,
      incidentPluginId: SupportedPlugin.Incident,
      onCallPluginId: SupportedPlugin.OnCall,
    });
    await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
  });

  describe('when IRM plugin does not exists in apps', () => {
    beforeEach(() => {
      setAppPluginMetas({});
    });

    it('isIrmPluginPresent should be false', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.isIrmPluginPresent).toBe(false);
    });

    it('incidentPluginId should be Incident plugin ID', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.incidentPluginId).toBe(SupportedPlugin.Incident);
    });

    it('onCallPluginId should be OnCall plugin ID', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.onCallPluginId).toBe(SupportedPlugin.OnCall);
    });
  });

  describe('when IRM plugin exists in apps', () => {
    beforeEach(() => {
      setAppPluginMetas({ [SupportedPlugin.Irm]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Irm]) });
    });

    it('isIrmPluginPresent should be true', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.isIrmPluginPresent).toBe(true);
    });

    it('incidentPluginId should be IRM plugin ID', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.incidentPluginId).toBe(SupportedPlugin.Irm);
    });

    it('onCallPluginId should be IRM plugin ID', async () => {
      const { result } = renderHook(() => useIrmConfig());

      await waitFor(() => expect(result.current.isIrmConfigLoading).toBe(false));
      expect(result.current.irmConfig.onCallPluginId).toBe(SupportedPlugin.Irm);
    });
  });
});
