import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

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

  if (excludedRoutes[location.pathname]) {
    return null;
  }

  return <InternalAppChromeExtensionPoint />;
}

function InternalAppChromeExtensionPoint(): JSX.Element | null {
  const { components, isLoading } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.AppChrome,
  });

  const filteredComponents = useMemo(
    () => components.filter((component) => component.meta.pluginId === 'grafana-setupguide-app'),
    [components]
  );

  if (isLoading || filteredComponents.length === 0) {
    return null;
  }

  return (
    <div id="app-chrome-extension-point">
      {filteredComponents.map((Component) => (
        <Component key={`acep-${Component.meta.id}`} />
      ))}
    </div>
  );
}
