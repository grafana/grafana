import { SafeDynamicImport } from 'app/core/components/DynamicImports/SafeDynamicImport';
import { ROUTE_BASE_ID } from './constants';
export function getRoutes() {
    return [
        {
            path: `/${ROUTE_BASE_ID}`,
            exact: false,
            component: SafeDynamicImport(() => import(/* webpackChunkName: "Connections"*/ 'app/features/connections/Connections')),
        },
    ];
}
//# sourceMappingURL=routes.js.map