import React from 'react';

import { GrafanaRouteComponent } from 'app/core/navigation/types';

export const SafeDynamicImport = (loader: () => Promise<any>): GrafanaRouteComponent => React.lazy(loader);
