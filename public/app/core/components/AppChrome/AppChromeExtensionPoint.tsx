import { useMemo } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';

export function AppChromeExtensionPoint(): JSX.Element | null {
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
