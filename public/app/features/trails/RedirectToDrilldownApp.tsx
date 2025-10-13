import { Navigate, useLocation, useParams } from 'react-router-dom-v5-compat';

import { getRouteForAppPlugin } from 'app/features/plugins/routes';

/**
 * Navigate to the drilldown app with the remaining path parameters and search params
 */
const RedirectToDrilldownApp = () => {
  const { '*': remainingPath } = useParams();
  const location = useLocation();
  const appPath = getRouteForAppPlugin('grafana-metricsdrilldown-app').path.replaceAll('*', '');
  const newPath = `${appPath}${remainingPath}${location.search}`;

  return <Navigate replace to={newPath} />;
};

export default RedirectToDrilldownApp;
