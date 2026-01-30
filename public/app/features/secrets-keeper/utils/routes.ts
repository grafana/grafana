import { config } from '@grafana/runtime';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { RouteDescriptor } from 'app/core/navigation/types';

import { SECRETS_KEEPER_BASE_URL } from '../constants';

/**
 * Returns routes for Secrets Keeper feature
 * Gated by secretsManagementAppPlatformUI feature flag
 */
export function getSecretsKeeperRoutes(): RouteDescriptor[] {
  const featureToggles = config.featureToggles || {};

  // Feature flag check
  if (!featureToggles.secretsManagementAppPlatformUI) {
    return [];
  }

  return [
    {
      path: SECRETS_KEEPER_BASE_URL,
      component: SafeDynamicImport(() => import(/* webpackChunkName: "SecretsKeeperHomePage"*/ '../HomePage')),
    },
    // TODO: Add more routes as features are built
    // {
    //   path: `${SECRETS_KEEPER_BASE_URL}/new`,
    //   component: SafeDynamicImport(
    //     () => import(/* webpackChunkName: "SecretsKeeperNewPage"*/ '../NewKeeperPage')
    //   ),
    // },
    // {
    //   path: `${SECRETS_KEEPER_BASE_URL}/:name`,
    //   component: SafeDynamicImport(
    //     () => import(/* webpackChunkName: "SecretsKeeperDetailPage"*/ '../DetailPage')
    //   ),
    // },
    // {
    //   path: `${SECRETS_KEEPER_BASE_URL}/:name/edit`,
    //   component: SafeDynamicImport(
    //     () => import(/* webpackChunkName: "SecretsKeeperEditPage"*/ '../EditPage')
    //   ),
    // },
  ];
}
