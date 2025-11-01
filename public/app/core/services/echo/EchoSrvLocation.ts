import { useEffect, useRef } from 'react';
import { matchPath, useLocation } from 'react-router-dom-v5-compat';

import { faro } from '@grafana/faro-web-sdk';
import { reportPageview } from '@grafana/runtime';
import { RouteDescriptor } from 'app/core/navigation/types';

import { getAppRoutes } from '../../../routes/routes';

export function EchoSrvLocationReporter() {
  const appRoutesRef = useRef<RouteDescriptor[]>();

  const location = useLocation();

  useEffect(() => {
    if (!appRoutesRef.current) {
      appRoutesRef.current = getAppRoutes();
    }
    const routes = appRoutesRef.current;

    // Find the matching route
    const matchedRoute = routes.find((route) => {
      return matchPath({ path: route.path, end: true }, location.pathname);
    });

    const pageId = matchedRoute?.path || location.pathname;

    // [FIXME] Pass the pageID into reportPageview, and get GrafanaJavascriptBackend to pick that up
    // and call faro.api.setPage there instead.
    console.log('Reporting pageview to EchoSrv for location:', { pageId, ...location });
    faro.api.setPage({
      url: location.pathname + location.search + location.hash,
      id: pageId,
    });
    reportPageview();
  }, [location]);

  return null;
}
