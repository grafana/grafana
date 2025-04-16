import { deprecationWarning } from '@grafana/data';
import { setLegacyAngularInjector } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export async function loadAndInitAngularIfEnabled() {
  // Temporary path to allow access to services exposed directly by the angular injector
  setLegacyAngularInjector({
    get: (key: string) => {
      switch (key) {
        case 'dashboardSrv': {
          // we do not yet have a public interface for this
          deprecationWarning('getLegacyAngularInjector', 'getDashboardSrv');
          return getDashboardSrv();
        }
      }
      throw 'Angular is no longer supported.  Unable to expose: ' + key;
    },
  });
}
