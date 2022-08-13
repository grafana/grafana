import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { RouteDescriptor } from 'app/core/navigation/types';

export function getRoutes(): RouteDescriptor[] {
  if (config.featureToggles.savedQueries) {
    return [
      {
        path: `/query-library`,
        exact: true,
        component: SafeDynamicImport(
          () =>
            import(/* webpackChunkName: "QueryLibraryPage" */ 'app/features/query-library/components/QueryLibraryPage')
        ),
      },
      {
        path: `/query-library/new`,
        exact: true,
        component: SafeDynamicImport(
          () => import(/* webpackChunkName: "QueryLibraryPage" */ 'app/features/query-library/components/NewQueryPage')
        ),
      },
    ];
  }

  return [];
}
