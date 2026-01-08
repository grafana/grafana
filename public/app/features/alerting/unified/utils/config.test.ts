import { config } from '@grafana/runtime';

import { pluginMeta, pluginMetaToPluginConfig } from '../testSetup/plugins';
import { SupportedPlugin } from '../types/pluginBridges';

import {
  checkEvaluationIntervalGlobalLimit,
  getIrmIfPresentOrIncidentPluginId,
  getIrmIfPresentOrOnCallPluginId,
  getIsIrmPluginPresent,
} from './config';

describe('checkEvaluationIntervalGlobalLimit', () => {
  it('should NOT exceed limit if evaluate every is not valid duration', () => {
    config.unifiedAlerting.minInterval = '2m30s';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('123notvalidduration');

    expect(globalLimit).toBe(150 * 1000);
    expect(exceedsLimit).toBe(false);
  });

  it('should NOT exceed limit if config minInterval is not valid duration', () => {
    config.unifiedAlerting.minInterval = '1A8IU3A';

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit('1m30s');

    expect(globalLimit).toBe(0);
    expect(exceedsLimit).toBe(false);
  });

  it.each([
    ['2m30s', '1m30s'],
    ['30s', '10s'],
    ['1d2h', '2h'],
    ['1y', '90d'],
  ])(
    'should exceed limit if config minInterval (%s) is greater than evaluate every (%s)',
    (minInterval, evaluateEvery) => {
      config.unifiedAlerting.minInterval = minInterval;

      const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

      expect(globalLimit).toBeGreaterThan(0);
      expect(exceedsLimit).toBe(true);
    }
  );

  it.each([
    ['1m30s', '2m30s'],
    ['30s', '1d'],
    ['1m10s', '1h30m15s'],
  ])('should NOT exceed limit if config minInterval is lesser than evaluate every', (minInterval, evaluateEvery) => {
    config.unifiedAlerting.minInterval = minInterval;

    const { globalLimit, exceedsLimit } = checkEvaluationIntervalGlobalLimit(evaluateEvery);

    expect(globalLimit).toBeGreaterThan(0);
    expect(exceedsLimit).toBe(false);
  });
});

describe('getIsIrmPluginPresent', () => {
  it('should return true when IRM plugin is present in config.apps', () => {
    config.apps = { [SupportedPlugin.Irm]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Irm]) };
    expect(getIsIrmPluginPresent()).toBe(true);
  });

  it('should return false when IRM plugin is not present in config.apps', () => {
    config.apps = {
      [SupportedPlugin.OnCall]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.OnCall]),
      [SupportedPlugin.Incident]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Incident]),
    };
    expect(getIsIrmPluginPresent()).toBe(false);
  });
});

describe('getIrmIfPresentOrIncidentPluginId', () => {
  it('should return IRM plugin ID when IRM plugin is present', () => {
    config.apps = { [SupportedPlugin.Irm]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Irm]) };
    expect(getIrmIfPresentOrIncidentPluginId()).toBe(SupportedPlugin.Irm);
  });

  it('should return Incident plugin ID when IRM plugin is not present', () => {
    config.apps = {
      [SupportedPlugin.OnCall]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.OnCall]),
      [SupportedPlugin.Incident]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Incident]),
    };
    expect(getIrmIfPresentOrIncidentPluginId()).toBe(SupportedPlugin.Incident);
  });
});

describe('getIrmIfPresentOrOnCallPluginId', () => {
  it('should return IRM plugin ID when IRM plugin is present', () => {
    config.apps = { [SupportedPlugin.Irm]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Irm]) };
    expect(getIrmIfPresentOrOnCallPluginId()).toBe(SupportedPlugin.Irm);
  });

  it('should return OnCall plugin ID when IRM plugin is not present', () => {
    config.apps = {
      [SupportedPlugin.OnCall]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.OnCall]),
      [SupportedPlugin.Incident]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Incident]),
    };
    expect(getIrmIfPresentOrOnCallPluginId()).toBe(SupportedPlugin.OnCall);
  });
});
