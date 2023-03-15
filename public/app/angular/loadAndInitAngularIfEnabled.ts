import { deprecationWarning } from '@grafana/data';
import { config, setAngularLoader, setLegacyAngularInjector } from '@grafana/runtime';
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
        switch (key) {
          case 'dashboardSrv': {
            deprecationWarning('getLegacyAngularInjector', 'getDashboardSrv'); // any suggestions?
            return getDashboardSrv();
          }
        }
        throw 'Angular is disabled.  Unable to expose: ' + key;
      },
    } as any);
  }
}
