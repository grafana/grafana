import { PluginLoadingStrategy, PluginSignatureStatus, PluginType } from '@grafana/data';

import { v0alpha1Response } from '../test-fixtures/v0alpha1Response';

import { v0alpha1DatasourceMapper } from './v0alpha1DatasourceMapper';

const DATASOURCE_IDS = v0alpha1Response.items
  .filter((i) => i.spec.pluginJson.type === 'datasource')
  .map((i) => ({ pluginId: i.spec.pluginJson.id }));

describe('v0alpha1DatasourceMapper', () => {
  describe.each(DATASOURCE_IDS)('when called for pluginId:$pluginId', ({ pluginId }) => {
    const spec = v0alpha1Response.items.find((i) => i.spec.pluginJson.id === pluginId)!.spec;

    it('should map id property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].id).toEqual(pluginId);
    });

    it('should map name property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].name).toEqual(spec.pluginJson.name);
    });

    it('should map type to datasource', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].type).toEqual(PluginType.datasource);
    });

    it('should map module property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].module).toEqual(spec.module.path);
    });

    it('should map baseUrl property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].baseUrl).toEqual(spec.baseURL);
    });

    it('should map moduleHash property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].moduleHash).toEqual(spec.module.hash);
    });

    it('should map angular property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].angular).toEqual({});
    });

    it('should map loadingStrategy property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      const expected =
        spec.module.loadingStrategy === 'script' ? PluginLoadingStrategy.script : PluginLoadingStrategy.fetch;
      expect(result[pluginId].loadingStrategy).toEqual(expected);
    });

    it('should map signature property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      const statusMap: Record<string, PluginSignatureStatus> = {
        internal: PluginSignatureStatus.internal,
        valid: PluginSignatureStatus.valid,
        invalid: PluginSignatureStatus.invalid,
        modified: PluginSignatureStatus.modified,
      };
      const expected = statusMap[spec.signature.status];
      expect(result[pluginId].signature).toEqual(expected);
    });

    it('should map translations property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].translations).toEqual(spec.translations);
    });

    it('should map metrics property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].metrics).toEqual(spec.pluginJson.metrics);
    });

    it('should map logs property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].logs).toEqual(spec.pluginJson.logs);
    });

    it('should map annotations property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].annotations).toEqual(spec.pluginJson.annotations);
    });

    it('should map alerting property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].alerting).toEqual(spec.pluginJson.alerting);
    });

    it('should map tracing property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].tracing).toEqual(spec.pluginJson.tracing);
    });

    it('should map streaming property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].streaming).toEqual(spec.pluginJson.streaming);
    });

    it('should map backend property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].backend).toEqual(spec.pluginJson.backend);
    });

    it('should map builtIn property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].builtIn).toEqual(spec.pluginJson.builtIn);
    });

    it('should map category property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].category).toEqual(spec.pluginJson.category);
    });

    it('should map queryOptions property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].queryOptions).toEqual(spec.pluginJson.queryOptions);
    });

    it('should map multiValueFilterOperators property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].multiValueFilterOperators).toEqual(spec.pluginJson.multiValueFilterOperators);
    });

    it('should map aliasIDs property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      expect(result[pluginId].aliasIDs).toEqual(spec.aliasIds);
    });

    it('should map info property correctly', () => {
      const result = v0alpha1DatasourceMapper(v0alpha1Response);

      const { keywords: resultKeywords, ...resultRest } = result[pluginId].info;

      expect(resultKeywords).toEqual(spec.pluginJson.info.keywords || []);
      expect(resultRest.description).toEqual(spec.pluginJson.info.description || '');
      expect(resultRest.version).toEqual(spec.pluginJson.info.version);
      expect(resultRest.updated).toEqual(spec.pluginJson.info.updated);
      expect(resultRest.author.name).toEqual(spec.pluginJson.info.author?.name || '');
    });
  });

  it('should only map specs with type datasource', () => {
    const result = v0alpha1DatasourceMapper(v0alpha1Response);

    const expectedCount = v0alpha1Response.items.filter((i) => i.spec.pluginJson.type === 'datasource').length;
    expect(Object.keys(result)).toHaveLength(expectedCount);
  });

  it('should not include panel or app plugins', () => {
    const result = v0alpha1DatasourceMapper(v0alpha1Response);

    for (const meta of Object.values(result)) {
      expect(meta.type).toEqual(PluginType.datasource);
    }
  });

  it('should map cloudwatch with all datasource-specific fields', () => {
    const result = v0alpha1DatasourceMapper(v0alpha1Response);
    const cloudwatch = result['cloudwatch'];

    expect(cloudwatch).toBeDefined();
    expect(cloudwatch.metrics).toBe(true);
    expect(cloudwatch.logs).toBe(true);
    expect(cloudwatch.alerting).toBe(true);
    expect(cloudwatch.annotations).toBe(true);
    expect(cloudwatch.backend).toBe(true);
    expect(cloudwatch.category).toBe('cloud');
    expect(cloudwatch.queryOptions).toEqual({ minInterval: true });
  });
});
