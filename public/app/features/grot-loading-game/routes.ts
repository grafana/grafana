import { config } from '@grafana/runtime';
import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { type RouteDescriptor } from 'app/core/navigation/types';

// The playground only exists to try the game locally, so it is never registered outside development builds.
export function getGrotLoadingGameRoutes(cfg = config): RouteDescriptor[] {
  if (cfg.buildInfo.env !== 'development') {
    return [];
  }

  return [
    {
      path: '/grot-game',
      component: SafeDynamicImport(
        () => import(/* webpackChunkName: "GrotLoadingGamePage"*/ 'app/features/grot-loading-game/GrotLoadingGamePage')
      ),
    },
  ];
}
