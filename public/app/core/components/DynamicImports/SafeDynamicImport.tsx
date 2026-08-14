import { lazy } from 'react';

import { type GrafanaRouteComponent } from 'app/core/navigation/types';

export const SafeDynamicImport = (loader: () => Promise<any>): GrafanaRouteComponent => lazy(loader);
