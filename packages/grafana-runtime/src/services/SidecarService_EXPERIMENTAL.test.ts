import * as H from 'history';

import { config } from '../config';

import { HistoryWrapper } from './LocationService';
import { SidecarService_EXPERIMENTAL } from './SidecarService_EXPERIMENTAL';

describe('SidecarService_EXPERIMENTAL', () => {
  let mainLocationService: HistoryWrapper;
  let sidecarService: SidecarService_EXPERIMENTAL;

  beforeAll(() => {
    config.featureToggles.appSidecar = true;
  });

  afterAll(() => {
    config.featureToggles.appSidecar = false;
  });

  beforeEach(() => {
    mainLocationService = new HistoryWrapper(H.createMemoryHistory({ initialEntries: ['/explore'] }));
    sidecarService = new SidecarService_EXPERIMENTAL(mainLocationService);
  });

  it('has the correct state after opening and closing an app', () => {
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
    sidecarService.openAppV2('pluginId', '/test');

    expect(sidecarService.activePluginId).toBe('pluginId');
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/a/pluginId/test');

    sidecarService.closeApp();
    expect(sidecarService.activePluginId).toBe(undefined);
    expect(sidecarService.initialContext).toBe(undefined);
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/');
  });

  it('has the correct state after opening and closing an app v3', () => {
    sidecarService.openAppV3({ pluginId: 'pluginId', path: '/test' });

    expect(sidecarService.activePluginId).toBe('pluginId');
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/a/pluginId/test');

    sidecarService.closeApp();
    expect(sidecarService.activePluginId).toBe(undefined);
    expect(sidecarService.initialContext).toBe(undefined);
    expect(sidecarService.getLocationService().getLocation().pathname).toBe('/');
  });

  it('reports correct opened state', () => {
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openApp('pluginId');
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('reports correct opened state v2', () => {
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openAppV2('pluginId');
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('reports correct opened state v3', () => {
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);

    sidecarService.openAppV3({ pluginId: 'pluginId' });
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);

    sidecarService.closeApp();
    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('autocloses on not allowed routes', () => {
    sidecarService.openAppV3({ pluginId: 'pluginId' });
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
    mainLocationService.push('/config');

    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('autocloses on when changing route', () => {
    sidecarService.openAppV3({ pluginId: 'pluginId' });
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
    mainLocationService.push('/a/other-app');

    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });

  it('does not autocloses when set to follow', () => {
    sidecarService.openAppV3({ pluginId: 'pluginId', follow: true });
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
    mainLocationService.push('/a/other-app');

    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
  });

  it('autocloses on not allowed routes when set to follow', () => {
    sidecarService.openAppV3({ pluginId: 'pluginId', follow: true });
    expect(sidecarService.isAppOpened('pluginId')).toBe(true);
    mainLocationService.push('/config');

    expect(sidecarService.isAppOpened('pluginId')).toBe(false);
  });
});
