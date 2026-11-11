import type { JSX } from 'react';

import { PluginExtensionPoints } from '@grafana/data';
import { renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';

interface DashboardEmptyExtensionPointProps {
  renderDefaultUI: () => JSX.Element;
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

export function DashboardEmptyExtensionPoint(props: DashboardEmptyExtensionPointProps): JSX.Element | null {
  const { components, isLoading } = usePluginComponents<DashboardEmptyExtensionPointProps>({
    extensionPointId: PluginExtensionPoints.DashboardEmpty,
  });

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    renderLimitedComponents<DashboardEmptyExtensionPointProps>({
      props,
      components: components,
      // We only ever want one component to replace the default empty state UI (so that we don't end up with two competing/default UIs being rendered).
      // And, currently, we only want to allow setupguide-app to be able to do this.
      limit: 1,
      pluginId: SETUPGUIDE_PLUGIN_ID,
    }) ?? props.renderDefaultUI()
  );
}
