import type { JSX } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { useFlagEnableAppChromeExtensions } from '@grafana/runtime/internal';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { useGrafana } from 'app/core/context/GrafanaContext';

export function AppChromeExtensionPoint(): JSX.Element | null {
  const { chrome } = useGrafana();
  const state = chrome.useState();
  const isEnabled = useFlagEnableAppChromeExtensions();

  if (!isEnabled) {
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
    pluginId: SETUPGUIDE_PLUGIN_ID,
  });
}
