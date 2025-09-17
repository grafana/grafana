import { PluginExtensionPoints } from '@grafana/data';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { useGrafana } from 'app/core/context/GrafanaContext';

export function AppChromeExtensionPoint(): JSX.Element | null {
  const { chrome } = useGrafana();
  const state = chrome.useState();

  if (config.featureToggles.enableAppChromeExtensions !== true) {
    return null;
  }

  if (state.chromeless) {
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
