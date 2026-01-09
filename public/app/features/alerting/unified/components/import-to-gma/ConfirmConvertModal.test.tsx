import { config } from '@grafana/runtime';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { pluginMeta, pluginMetaToPluginConfig } from '../../testSetup/plugins';
import { SupportedPlugin } from '../../types/pluginBridges';
import { GRAFANA_ORIGIN_LABEL } from '../../utils/labels';

import { SYNTHETICS_RULE_NAMES, filterRulerRulesConfig } from './ConfirmConvertModal';

describe('filterRulerRulesConfig', () => {
  const mockRulesConfig: RulerRulesConfigDTO = {
    namespace1: [
      {
        name: 'group1',
        rules: [
          {
            alert: 'Alert1',
            expr: 'up == 0',
            labels: {
              severity: 'warning',
            },
          },
          {
            alert: 'Alert2',
            expr: 'down == 1',
            labels: {
              [GRAFANA_ORIGIN_LABEL]: `plugin/${SupportedPlugin.Slo}`,
            },
          },
        ],
      },
      {
        name: 'group2',
        rules: [
          {
            alert: 'Alert3',
            expr: 'error == 1',
          },
          {
            alert: SYNTHETICS_RULE_NAMES[0],
            expr: 'error == 1',
            labels: {
              namespace: 'synthetic_monitoring',
            },
          },
          {
            alert: 'Alert7',
            expr: 'test == 0',
            labels: {
              namespace: 'integrations-test',
            },
          },
        ],
      },
    ],
    namespace2: [
      {
        name: 'group3',
        rules: [
          {
            alert: 'Alert4',
            expr: 'test == 0',
          },
        ],
      },
    ],
  };

  it('should filter by namespace', () => {
    config.apps = { [SupportedPlugin.Slo]: pluginMetaToPluginConfig(pluginMeta[SupportedPlugin.Slo]) };
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(mockRulesConfig, 'namespace1');

    expect(filteredConfig).toEqual({
      namespace1: [
        {
          name: 'group1',
          rules: [
            {
              alert: 'Alert1',
              expr: 'up == 0',
              labels: {
                severity: 'warning',
              },
            },
          ],
        },
        {
          name: 'group2',
          rules: [
            {
              alert: 'Alert3',
              expr: 'error == 1',
            },
          ],
        },
      ],
    });
    expect(someRulesAreSkipped).toBe(true);
  });

  it('should filter by group name', () => {
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(mockRulesConfig, 'namespace1', 'group1');

    expect(filteredConfig).toEqual({
      namespace1: [
        {
          name: 'group1',
          rules: [
            {
              alert: 'Alert1',
              expr: 'up == 0',
              labels: {
                severity: 'warning',
              },
            },
          ],
        },
      ],
    });
    expect(someRulesAreSkipped).toBe(true);
  });

  it('should filter out rules with grafana origin label', () => {
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(mockRulesConfig);

    expect(filteredConfig).toEqual({
      namespace1: [
        {
          name: 'group1',
          rules: [
            {
              alert: 'Alert1',
              expr: 'up == 0',
              labels: {
                severity: 'warning',
              },
            },
          ],
        },
        {
          name: 'group2',
          rules: [
            {
              alert: 'Alert3',
              expr: 'error == 1',
            },
          ],
        },
      ],
      namespace2: [
        {
          name: 'group3',
          rules: [
            {
              alert: 'Alert4',
              expr: 'test == 0',
            },
          ],
        },
      ],
    });
    expect(someRulesAreSkipped).toBe(true);
  });

  it('should return empty config when no rules match filters', () => {
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(mockRulesConfig, 'nonexistent-namespace');

    expect(filteredConfig).toEqual({});
    expect(someRulesAreSkipped).toBe(false);
  });

  it('should handle empty rules config', () => {
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig({});

    expect(filteredConfig).toEqual({});
    expect(someRulesAreSkipped).toBe(false);
  });

  it('should handle empty groups', () => {
    const emptyGroupsConfig: RulerRulesConfigDTO = {
      namespace1: [],
    };

    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(emptyGroupsConfig);

    expect(filteredConfig).toEqual({});
    expect(someRulesAreSkipped).toBe(false);
  });

  it('should handle empty rules array', () => {
    const emptyRulesConfig: RulerRulesConfigDTO = {
      namespace1: [
        {
          name: 'group1',
          rules: [],
        },
      ],
    };

    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(emptyRulesConfig);

    expect(filteredConfig).toEqual({});
    expect(someRulesAreSkipped).toBe(false);
  });

  it('should filter out synthetics rules and rules from integrations', () => {
    const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(mockRulesConfig);

    expect(filteredConfig).toEqual({
      namespace1: [
        {
          name: 'group1',
          rules: [
            {
              alert: 'Alert1',
              expr: 'up == 0',
              labels: {
                severity: 'warning',
              },
            },
          ],
        },
        {
          name: 'group2',
          rules: [
            {
              alert: 'Alert3',
              expr: 'error == 1',
            },
          ],
        },
      ],
      namespace2: [
        {
          name: 'group3',
          rules: [
            {
              alert: 'Alert4',
              expr: 'test == 0',
            },
          ],
        },
      ],
    });
    expect(someRulesAreSkipped).toBe(true);
  });
});
