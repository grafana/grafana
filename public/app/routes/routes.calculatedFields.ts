import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { config } from 'app/core/config';
import { contextSrv } from 'app/core/core';
import { RouteDescriptor } from 'app/core/navigation/types';

export const getCalcFieldRoutes = (cfg = config): RouteDescriptor[] => {
  return [
    {
      path: '/calculated-fields',
      roles: () => contextSrv.evaluatePermission(['calculated.fields:read']),
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "ReportsListPage" */ 'app/features/calculated-fields/List/components/CalculatedFieldsList'
          )
      ),
    },
    {
      path: '/calculated-fields/:action/:uid?',
      roles: () => contextSrv.evaluatePermission(['calculated.fields:create']),
      component: SafeDynamicImport(
        () =>
          import(
            /* webpackChunkName: "ReportsListPage" */ 'app/features/calculated-fields/Modify/components/CalculatedFieldsModify'
          )
      ),
    },
  ];
};
