import { apps } from '../test-fixtures/config.apps';
import { v0alpha1Response } from '../test-fixtures/v0alpha1Response';

import { v0alpha1AppMapper } from './v0alpha1AppMapper';

const PLUGIN_IDS = v0alpha1Response.items
  .filter((i) => i.spec.pluginJson.type === 'app')
  .map((i) => ({ pluginId: i.spec.pluginJson.id }));

describe('v0alpha1AppMapper', () => {
  describe.each(PLUGIN_IDS)('when called for pluginId:$pluginId', ({ pluginId }) => {
    it('should map id property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].id).toEqual(apps[pluginId].id);
    });

    it('should map path property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].path).toEqual(apps[pluginId].path);
    });

    it('should map version property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].version).toEqual(apps[pluginId].version);
    });

    it('should map preload property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].preload).toEqual(apps[pluginId].preload);
    });

    it('should map angular property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].angular).toEqual({});
    });

    it('should map loadingStrategy property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].loadingStrategy).toEqual(apps[pluginId].loadingStrategy);
    });

    it('should map dependencies property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].dependencies).toEqual(apps[pluginId].dependencies);
    });

    it('should map extensions property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].extensions.addedComponents).toEqual(apps[pluginId].extensions.addedComponents);
      expect(result[pluginId].extensions.addedFunctions).toEqual(apps[pluginId].extensions.addedFunctions);
      expect(result[pluginId].extensions.addedLinks).toEqual(apps[pluginId].extensions.addedLinks);
      expect(result[pluginId].extensions.exposedComponents).toEqual(apps[pluginId].extensions.exposedComponents);
      expect(result[pluginId].extensions.extensionPoints).toEqual(apps[pluginId].extensions.extensionPoints);
    });

    it('should map moduleHash property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].moduleHash).toEqual(apps[pluginId].moduleHash);
    });

    it('should map buildMode property correctly', () => {
      const result = v0alpha1AppMapper(v0alpha1Response);

      expect(result[pluginId].buildMode).toEqual(apps[pluginId].buildMode);
    });
  });

  it('should only map specs with type app', () => {
    const result = v0alpha1AppMapper(v0alpha1Response);

    expect(v0alpha1Response.items).toHaveLength(58);
    expect(Object.keys(result)).toHaveLength(5);
    expect(Object.keys(result)).toEqual(Object.keys(apps));
  });
});
