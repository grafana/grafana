import { GrafanaConfig } from '@grafana/data';
import { LocationService } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { GrafanaContextType } from 'app/core/context/GrafanaContext';
import { backendSrv } from 'app/core/services/backend_srv';
import { KeybindingSrv } from 'app/core/services/keybindingSrv';

/** Not sure what this should evolve into, just a starting point */
export function getGrafanaContextMock(overrides: Partial<GrafanaContextType> = {}): GrafanaContextType {
  return {
    chrome: new AppChromeService(),
    backend: backendSrv,
    // eslint-disable-next-line
    location: {} as LocationService,
    // eslint-disable-next-line
    config: { featureToggles: {} } as GrafanaConfig,
    // eslint-disable-next-line
    keybindings: {
      clearAndInitGlobalBindings: jest.fn(),
      setupDashboardBindings: jest.fn(),
      setupTimeRangeBindings: jest.fn(),
    } as unknown as KeybindingSrv,
    ...overrides,
  };
}
