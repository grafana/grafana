import { PluginContextType } from '@grafana/data';

import * as errors from './errors';
import { ExtensionsLog } from './logs/log';
import { isGrafanaDevMode } from './utils';
import { validateExtensionPoint } from './validateExtensionPoint';
import * as validators from './validators';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),

  // Manually set the dev mode to false
  // (to make sure that by default we are testing a production scenario)
  isGrafanaDevMode: jest.fn().mockReturnValue(false),
}));

const setup = ({
  pointValid = true,
  metaMissing = false,
  corePlugin = false,
}: { pointValid?: boolean; metaMissing?: boolean; corePlugin?: boolean } = {}) => {
  const spyIsExtensionPointIdValid = jest.spyOn(validators, 'isExtensionPointIdValid').mockReturnValue(pointValid);
  const spyisExtensionPointMetaInfoMissing = jest
    .spyOn(validators, 'isExtensionPointMetaInfoMissing')
    .mockReturnValue(metaMissing);
  const pluginId = 'myorg-extensions-app';
  const extensionPointId = `${pluginId}/extension-point/v1`;
  const pluginContext = { meta: { id: pluginId, module: corePlugin ? 'core:' : '' } } as PluginContextType;

  return {
    spyIsExtensionPointIdValid,
    spyisExtensionPointMetaInfoMissing,
    pluginId,
    extensionPointId,
    pluginContext,
  };
};

describe('getExtensionValidationResults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when calling in production mode', () => {
    beforeEach(() => {
      jest.mocked(isGrafanaDevMode).mockReturnValue(false);
    });

    it('should return isLoading:true while loading app plugins', () => {
      const { extensionPointId, pluginContext } = setup();

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: true,
        pluginContext,
      });

      expect(actual.result).toEqual({ isLoading: true });
      expect(actual.pointLog).toBeDefined();
    });

    it('should return null when all validations pass', () => {
      const { extensionPointId, pluginContext } = setup();

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: false,
        pluginContext,
      });

      expect(actual.result).toBe(null);
      expect(actual.pointLog).toBeDefined();
    });
  });

  describe('when calling in dev mode', () => {
    let errorSpy: jest.SpyInstance;
    beforeEach(() => {
      jest.mocked(isGrafanaDevMode).mockReturnValue(true);
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    it('should return isLoading:false when extension point is invalid', () => {
      const {
        extensionPointId,
        pluginContext,
        pluginId,
        spyIsExtensionPointIdValid,
        spyisExtensionPointMetaInfoMissing,
      } = setup({ pointValid: false });

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: true,
        pluginContext,
      });

      expect(actual.result).toEqual({ isLoading: false });
      expect(actual.pointLog).toBeDefined();
      expect(spyisExtensionPointMetaInfoMissing).not.toHaveBeenCalled();
      expect(spyIsExtensionPointIdValid).toHaveBeenCalledTimes(1);
      expect(spyIsExtensionPointIdValid).toHaveBeenCalledWith({
        extensionPointId,
        pluginId,
        isInsidePlugin: true,
        isCoreGrafanaPlugin: false,
        log: expect.any(ExtensionsLog),
      });
    });

    it('should return isLoading:false when extension point meta is missing', () => {
      const { extensionPointId, pluginContext, pluginId, spyisExtensionPointMetaInfoMissing } = setup({
        metaMissing: true,
      });

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: true,
        pluginContext,
      });

      expect(actual.result).toEqual({ isLoading: false });
      expect(actual.pointLog).toBeDefined();
      expect(spyisExtensionPointMetaInfoMissing).toHaveBeenCalled();
      expect(spyisExtensionPointMetaInfoMissing).toHaveBeenCalledWith(extensionPointId, pluginContext);
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(errors.EXTENSION_POINT_META_INFO_MISSING, { extensionPointId, pluginId });
    });

    it('should ignore core plugins when extension point meta is missing', () => {
      const { extensionPointId, pluginContext, spyisExtensionPointMetaInfoMissing } = setup({
        metaMissing: true,
        corePlugin: true,
      });

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: false,
        pluginContext,
      });

      expect(actual.result).toEqual(null);
      expect(actual.pointLog).toBeDefined();
      expect(spyisExtensionPointMetaInfoMissing).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('should return isLoading:true while loading app plugins', () => {
      const { extensionPointId, pluginContext } = setup();

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: true,
        pluginContext,
      });

      expect(actual.result).toEqual({ isLoading: true });
      expect(actual.pointLog).toBeDefined();
    });

    it('should return null when all validations pass', () => {
      const { extensionPointId, pluginContext } = setup();

      const actual = validateExtensionPoint({
        extensionPointId,
        isLoadingAppPlugins: false,
        pluginContext,
      });

      expect(actual.result).toBe(null);
      expect(actual.pointLog).toBeDefined();
    });
  });
});
