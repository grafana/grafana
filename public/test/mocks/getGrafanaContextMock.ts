import { GrafanaBootConfig, LocationService } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { GrafanaContextType } from 'app/core/context/GrafanaContext';
import { NewFrontendAssetsChecker } from 'app/core/services/NewFrontendAssetsChecker';
import { backendSrv } from 'app/core/services/backend_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';

/** Not sure what this should evolve into, just a starting point */
export function getGrafanaContextMock(overrides: Partial<GrafanaContextType> = {}): GrafanaContextType {
  return {
    chrome: new AppChromeService(),
    backend: backendSrv,
    location: {} as LocationService,
    config: { featureToggles: {} } as GrafanaBootConfig,
    keybindings: {
      clearAndInitGlobalBindings: jest.fn(),
      setupDashboardBindings: jest.fn(),
      setupTimeRangeBindings: jest.fn(),
    } as unknown as KeybindingSrv,
    newAssetsChecker: {
      start: jest.fn(),
      reloadIfUpdateDetected: jest.fn(),
    } as unknown as NewFrontendAssetsChecker,
    ...overrides,
  };
}
