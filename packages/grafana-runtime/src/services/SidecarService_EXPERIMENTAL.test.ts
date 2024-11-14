import { config } from '../config';

import { SidecarService_EXPERIMENTAL } from './SidecarService_EXPERIMENTAL';

describe('SidecarService_EXPERIMENTAL', () => {
  beforeEach(() => {
    config.featureToggles.appSidecar = true;
  });
  afterEach(() => {
    config.featureToggles.appSidecar = undefined;
  });

  it('has the correct state after opening and closing an app', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL();
    sidecarService.openApp('pluginId', { filter: 'test' });

    expect(sidecarService.activePluginId).toBe('pluginId');
    expect(sidecarService.initialContext).toMatchObject({ filter: 'test' });
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/a/pluginId');

    sidecarService.closeApp();
    expect(sidecarService.activePluginId).toBe(undefined);
    expect(sidecarService.initialContext).toBe(undefined);
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/');
  });

  it('has the correct state after opening and closing an app v2', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL();
    sidecarService.openAppV2('pluginId', '/test');

    expect(sidecarService.activePluginId).toBe('pluginId');
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/a/pluginId/test');

    sidecarService.closeApp();
    expect(sidecarService.activePluginId).toBe(undefined);
    expect(sidecarService.initialContext).toBe(undefined);
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/');
  });

  it('reports correct opened state', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openApp('pluginId');
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('reports correct opened state v2', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openAppV2('pluginId');
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });
});
