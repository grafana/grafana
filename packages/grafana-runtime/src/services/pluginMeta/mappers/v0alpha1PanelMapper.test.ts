import { clockPanelConfigCDN, clockPanelConfigOnPrem, panels } from '../test-fixtures/config.panels';
import { clockPanelMetaCDN, clockPanelMetaOnPrem, v0alpha1Response } from '../test-fixtures/v0alpha1Response';

import { v0alpha1PanelMapper } from './v0alpha1PanelMapper';

const PLUGIN_IDS = v0alpha1Response.items
  .filter((i) => i.spec.pluginJson.type === 'panel')
  .map((i) => ({ pluginId: i.spec.pluginJson.id }));

describe('v0alpha1PanelMapper', () => {
  describe.each(PLUGIN_IDS)('when called for pluginId:$pluginId', ({ pluginId }) => {
    it('should map id property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].id).toEqual(panels[pluginId].id);
    });

    it('should name id property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].name).toEqual(panels[pluginId].name);
    });

    it('should name info property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      const { keywords: resultKeywords, ...resultRest } = result[pluginId].info;
      const { keywords: configKeywords, ...configRest } = panels[pluginId].info;

      expect(resultRest).toEqual(configRest);
      expect(resultKeywords).toEqual(configKeywords || []); // keywords in config.panels is null when missing keywords
    });

    it('should name hideFromList property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].hideFromList).toEqual(panels[pluginId].hideFromList);
    });

    it('should name sort property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].sort).toEqual(panels[pluginId].sort);
    });

    it('should name skipDataQuery property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].skipDataQuery).toEqual(panels[pluginId].skipDataQuery);
    });

    it('should name suggestions property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].suggestions).toEqual(panels[pluginId].suggestions);
    });

    it('should name state property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].state).toEqual(panels[pluginId].state);
    });

    it('should name baseUrl property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].baseUrl).toEqual(panels[pluginId].baseUrl);
    });

    it('should name signature property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].signature).toEqual(panels[pluginId].signature);
    });

    it('should name module property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].module).toEqual(panels[pluginId].module);
    });

    it('should name angular property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].angular).toEqual({});
    });

    it('should name loadingStrategy property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].loadingStrategy).toEqual(panels[pluginId].loadingStrategy);
    });

    it('should name type property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].type).toEqual('panel');
    });

    it('should name translations property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].translations).toEqual(panels[pluginId].translations);
    });

    it('should name moduleHash property correctly', () => {
      const result = v0alpha1PanelMapper(v0alpha1Response);

      expect(result[pluginId].moduleHash).toEqual(panels[pluginId].moduleHash);
    });
  });

  it('should only map specs with type panel', () => {
    const result = v0alpha1PanelMapper(v0alpha1Response);

    expect(v0alpha1Response.items).toHaveLength(53);
    expect(Object.keys(result)).toHaveLength(27);
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
