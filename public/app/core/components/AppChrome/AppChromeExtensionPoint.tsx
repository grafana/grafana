import { useLocation } from 'react-router-dom';

import { PluginExtensionPoints } from '@grafana/data';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';

const excludedRoutes: Record<string, boolean> = {
  '/login': true,
  '/signup': true,
  '/verify': true,
  '/user/password/send-reset-email': true,
  '/user/password/reset': true,
  '/sandbox/benchmarks': true,
};

export function AppChromeExtensionPoint(): JSX.Element | null {
  const location = useLocation();

  if (config.featureToggles.enableAppChromeExtensions !== true) {
    return null;
  }

  if (excludedRoutes[location.pathname]) {
    return null;
  }

  return <InternalAppChromeExtensionPoint />;
}

// We have this "internal" component so we can prevent pre-loading the plugins associated with the extension-point if the feature is not enabled.
function InternalAppChromeExtensionPoint(): JSX.Element | null {
  const { components, isLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.AppChrome,
  });

  if (isLoading) {
    return null;
  }

  return renderLimitedComponents({
    props: {},
    components: components,
    pluginId: 'grafana-setupguide-app',
  });
}
