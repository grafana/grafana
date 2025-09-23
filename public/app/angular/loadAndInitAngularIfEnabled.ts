import { deprecationWarning } from '@grafana/data';
import {
  config,
  setAngularLoader,
  setLegacyAngularInjector,
  getDataSourceSrv,
  getBackendSrv,
  getTemplateSrv,
} from '@grafana/runtime';
import { contextSrv } from 'app/core/core';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { validationSrv } from 'app/features/manage-dashboards/services/ValidationSrv';
import { getLinkSrv } from 'app/features/panel/panellinks/link_srv';

export async function loadAndInitAngularIfEnabled() {
  if (config.angularSupportEnabled) {
    const { AngularApp } = await import(/* webpackChunkName: "AngularApp" */ './index');
    const app = new AngularApp();
    app.init();
    app.bootstrap();
  } else {
    // Register a dummy loader that does nothing
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
          case 'backendSrv': {
            deprecationWarning('getLegacyAngularInjector', 'backendSrv', 'use getBackendSrv() in @grafana/runtime');
            return getBackendSrv();
          }

          case 'contextSrv': {
            deprecationWarning('getLegacyAngularInjector', 'contextSrv');
            return contextSrv;
          }

          case 'dashboardSrv': {
            // we do not yet have a public interface for this
            deprecationWarning('getLegacyAngularInjector', 'getDashboardSrv');
            return getDashboardSrv();
          }

          case 'datasourceSrv': {
            deprecationWarning(
              'getLegacyAngularInjector',
              'datasourceSrv',
              'use getDataSourceSrv() in @grafana/runtime'
            );
            return getDataSourceSrv();
          }

          case 'linkSrv': {
            // we do not yet have a public interface for this
            deprecationWarning('getLegacyAngularInjector', 'linkSrv');
            return getLinkSrv();
          }

          case 'validationSrv': {
            // we do not yet have a public interface for this
            deprecationWarning('getLegacyAngularInjector', 'validationSrv');
            return validationSrv;
          }

          case 'timeSrv': {
            // we do not yet have a public interface for this
            deprecationWarning('getLegacyAngularInjector', 'timeSrv');
            return getTimeSrv();
          }

          case 'templateSrv': {
            deprecationWarning('getLegacyAngularInjector', 'templateSrv', 'use getTemplateSrv() in @grafana/runtime');
            return getTemplateSrv();
          }
        }
        throw 'Angular is disabled.  Unable to expose: ' + key;
      },
    } as angular.auto.IInjectorService);
  }
}
