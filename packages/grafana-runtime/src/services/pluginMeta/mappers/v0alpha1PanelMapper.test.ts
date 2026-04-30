/* eslint-disable @grafana/no-restricted-img-srcs */
import { clockPanelConfigCDN, clockPanelConfigOnPrem, panels } from '../test-fixtures/config.panels';
import { clockPanelMetaCDN, clockPanelMetaOnPrem, v0alpha1Response } from '../test-fixtures/v0alpha1Response';

import { coreSpecMapper, v0alpha1PanelMapper } from './v0alpha1PanelMapper';

const PLUGIN_IDS = v0alpha1Response.items
  .filter((i) => i.spec.pluginJson.type === 'panel')
  .map((i) => ({ pluginId: i.spec.pluginJson.id }));

describe('v0alpha1PanelMapper', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__grafana_public_path__ = '';
  });

  describe.each(PLUGIN_IDS)('when called for pluginId:$pluginId', ({ pluginId }) => {
    it('should map id property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].id).toEqual(panels[pluginId].id);
    });

    it('should map name property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].name).toEqual(panels[pluginId].name);
    });

    it('should map info property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      const { keywords: resultKeywords, ...resultRest } = result[pluginId].info;
      const { keywords: configKeywords, ...configRest } = panels[pluginId].info;

      expect(resultRest).toEqual(configRest);
      expect(resultKeywords).toEqual(configKeywords || []); // keywords in config.panels is null when missing keywords
    });

    it('should map hideFromList property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].hideFromList).toEqual(panels[pluginId].hideFromList);
    });

    it('should map sort property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].sort).toEqual(panels[pluginId].sort);
    });

    it('should map skipDataQuery property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].skipDataQuery).toEqual(panels[pluginId].skipDataQuery);
    });

    it('should map suggestions property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].suggestions).toEqual(panels[pluginId].suggestions);
    });

    it('should map state property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].state).toEqual(panels[pluginId].state);
    });

    it('should map baseUrl property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].baseUrl).toEqual(panels[pluginId].baseUrl);
    });

    it('should map signature property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].signature).toEqual(panels[pluginId].signature);
    });

    it('should map module property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].module).toEqual(panels[pluginId].module);
    });

    it('should map angular property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].angular).toEqual({ detected: false });
    });

    it('should map loadingStrategy property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].loadingStrategy).toEqual(panels[pluginId].loadingStrategy);
    });

    it('should map type property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].type).toEqual('panel');
    });

    it('should map translations property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].translations).toEqual(panels[pluginId].translations);
    });

    it('should map moduleHash property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].moduleHash).toEqual(panels[pluginId].moduleHash);
    });

    it('should map aliasIDs property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].aliasIDs).toEqual(panels[pluginId].aliasIDs);
    });
  });

  it('should only map specs with type panel', () => {
    const result = v0alpha1PanelMapper(v0alpha1Response);

    expect(v0alpha1Response.items).toHaveLength(54);
    expect(Object.keys(result)).toHaveLength(28);
    expect(Object.keys(result)).toEqual(Object.keys(panels));
  });

  it('should map correct url for logos and screenshots when using CDN', () => {
    const result = v0alpha1PanelMapper({ items: [clockPanelMetaCDN] });

    const actual = result[clockPanelConfigCDN.id];

    expect(actual.info.logos).toEqual(clockPanelConfigCDN.info.logos);
    expect(actual.info.screenshots).toEqual(clockPanelConfigCDN.info.screenshots);
  });

  it('should map correct url for logos and screenshots when not using CDN', () => {
    const result = v0alpha1PanelMapper({ items: [clockPanelMetaOnPrem] });

    const actual = result[clockPanelConfigOnPrem.id];

    expect(actual.info.logos).toEqual(clockPanelConfigOnPrem.info.logos);
    expect(actual.info.screenshots).toEqual(clockPanelConfigOnPrem.info.screenshots);
  });
});

const azureMeta = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'grafana-azure-monitor-datasource')!;
const promMeta = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === 'prometheus')!;

describe('coreSpecMapper when called with a core plugin on cloud', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__grafana_public_path__ =
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/';
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__grafana_public_path__;
  });

  it('should resolve correct urls for a decoupled plugin', () => {
    const result = coreSpecMapper(azureMeta.spec);

    expect(result.baseUrl).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist'
    );
    expect(result.module).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/module.js'
    );
    expect(result.info.logos.large).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/logo.jpg'
    );
    expect(result.info.logos.small).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/logo.jpg'
    );
    expect(result.info.screenshots).toEqual([
      {
        name: 'Azure Contoso Loans',
        path: 'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/contoso_loans_grafana_dashboard.png',
      },
      {
        name: 'Azure Monitor Network',
        path: 'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/azure_monitor_network.png',
      },
      {
        name: 'Azure Monitor CPU',
        path: 'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/azure_monitor_cpu.png',
      },
    ]);
  });

  it('should resolve correct urls for a non decoupled plugin', () => {
    const result = coreSpecMapper(promMeta.spec);

    expect(result.baseUrl).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/prometheus'
    );
    expect(result.module).toBe('core:plugin/prometheus');
    expect(result.info.logos.large).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg'
    );
    expect(result.info.logos.small).toBe(
      'https://grafana-assets.grafana-dev.net/grafana/13.0.0-24045599351/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg'
    );
    expect(result.info.screenshots).toEqual([]);
  });
});

describe('coreSpecMapper when called with a core plugin on prem', () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>).__grafana_public_path__ = 'public/';
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__grafana_public_path__;
  });

  it('should resolve correct urls for a decoupled plugin', () => {
    const result = coreSpecMapper(azureMeta.spec);

    expect(result.baseUrl).toBe('public/app/plugins/datasource/grafana-azure-monitor-datasource/dist');
    expect(result.module).toBe('public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/module.js');
    expect(result.info.logos.large).toBe(
      'public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/logo.jpg'
    );
    expect(result.info.logos.small).toBe(
      'public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/logo.jpg'
    );
    expect(result.info.screenshots).toEqual([
      {
        name: 'Azure Contoso Loans',
        path: 'public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/contoso_loans_grafana_dashboard.png',
      },
      {
        name: 'Azure Monitor Network',
        path: 'public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/azure_monitor_network.png',
      },
      {
        name: 'Azure Monitor CPU',
        path: 'public/app/plugins/datasource/grafana-azure-monitor-datasource/dist/img/azure_monitor_cpu.png',
      },
    ]);
  });

  it('should resolve correct urls for a non decoupled plugin', () => {
    const result = coreSpecMapper(promMeta.spec);

    expect(result.baseUrl).toBe('public/app/plugins/datasource/prometheus');
    expect(result.module).toBe('core:plugin/prometheus');
    expect(result.info.logos.large).toBe('public/app/plugins/datasource/prometheus/img/prometheus_logo.svg');
    expect(result.info.logos.small).toBe('public/app/plugins/datasource/prometheus/img/prometheus_logo.svg');
    expect(result.info.screenshots).toEqual([]);
  });
});
