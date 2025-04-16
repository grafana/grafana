let singleton: InjectorService;

interface InjectorService {
  get: (key: string) => unknown;
}

/**
 * Used during startup by Grafana to temporarily expose a fake angular injector
 * to pure javascript plugins using {@link getLegacyAngularInjector}.
 *
 * @internal
 */
export const setLegacyAngularInjector = (instance: InjectorService) => {
  singleton = instance;
};

/**
 * WARNING: this function provides a temporary way for plugins to access anything in the
 * angular injector.  While the migration from angular to react continues, there are a few
 * options that do not yet have good alternatives.  Note that use of this function will
 * be removed in the future.
 *
 * @deprecated Will be removed in grafana 12+
 */
export const getLegacyAngularInjector = (): InjectorService => singleton;
