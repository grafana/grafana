import { config } from '@grafana/runtime';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';

import { PROVISIONING_URL } from '../constants';

export function getProvisioningRoutes(): RouteDescriptor[] {
  if (!config.featureToggles.provisioning) {
    return [
      {
        path: PROVISIONING_URL,
        component: SafeDynamicImport(
          () => import(/* webpackChunkName: "SetupWarningPage"*/ 'app/features/provisioning/SetupWarningPage')
        ),
      },
    ];
  }

  return [
    {
      path: PROVISIONING_URL,
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "RepositoryListPage"*/ 'app/features/provisioning/SetupWarningPage')
      ),
    },
  ];
}
