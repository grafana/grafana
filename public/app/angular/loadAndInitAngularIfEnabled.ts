import { deprecationWarning } from '@grafana/data';
import { config, setAngularLoader, setLegacyAngularInjector, getDataSourceSrv, getBackendSrv } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

export async function loadAndInitAngularIfEnabled() {
  if (config.angularSupportEnabled) {
    const { AngularApp } = await import(/* webpackChunkName: "AngularApp" */ './index');
    const app = new AngularApp();
    app.init();
    app.bootstrap();
  } else {
    setAngularLoader({
      load: (elem, scopeProps, template) => {
        return {
          destroy: () => {},
          digest: () => {},
          getScope: () => {
            return {};
          },
        };
      },
    });

    // Temporary path to allow access to services exposed directly by the angular injector
    setLegacyAngularInjector({
      get: (key: string) => {
        // See ./registerComponents.ts
        switch (key) {
          // This does not yet have a better option
          case 'dashboardSrv': {
            deprecationWarning('getLegacyAngularInjector', 'getDashboardSrv');
            // deprecated... but not yet clear what we want to actually expose :grimmice:
            return getDashboardSrv();
          }

          // These have better options in @grafana/runtime
          case 'datasourceSrv': {
            deprecationWarning(
              'getLegacyAngularInjector',
              'datasourceSrv',
              'use getDataSourceSrv() in @grafana/runtime'
            ); // any suggestions?
            return getDataSourceSrv();
          }
          case 'backendSrv': {
            deprecationWarning('getLegacyAngularInjector', 'backendSrv', 'use getBackendSrv() in @grafana/runtime');
            return getBackendSrv();
          }
        }
        throw 'Angular is disabled.  Unable to expose: ' + key;
      },
    } as any);
  }
}
