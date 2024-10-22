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
    const sidecarService = new SidecarService_EXPERIMENTAL({});
    sidecarService.openApp('pluginId', { filter: 'test' });

    expect(sidecarService.activePluginId).toBe('pluginId');
    expect(sidecarService.initialContext).toMatchObject({ filter: 'test' });

    sidecarService.closeApp('pluginId');
    expect(sidecarService.activePluginId).toBe(undefined);
    expect(sidecarService.initialContext).toBe(undefined);
  });

  it('reports correct opened state', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL({});
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openApp('pluginId');

    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp('pluginId');

    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('does not close app that is not opened', () => {
    const sidecarService = new SidecarService_EXPERIMENTAL({});
    sidecarService.openApp('pluginId');

    sidecarService.closeApp('foobar');

    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
    expect(sidecarService.activePluginId).toBe('pluginId');
  });
});
