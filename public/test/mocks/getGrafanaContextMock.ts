import { GrafanaConfig } from '@grafana/data';
import { BackendSrv, LocationService } from '@grafana/runtime';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { GrafanaContextType } from 'app/core/context/GrafanaContext';

/** Not sure what this should evolve into, just a starting point */
export function getGrafanaContextMock(overrides: Partial<GrafanaContextType> = {}): GrafanaContextType {
  return {
    chrome: new AppChromeService(),
    // eslint-disable-next-line
    backend: {} as BackendSrv,
    // eslint-disable-next-line
    location: {} as LocationService,
    // eslint-disable-next-line
    config: {} as GrafanaConfig,
    ...overrides,
  };
}
