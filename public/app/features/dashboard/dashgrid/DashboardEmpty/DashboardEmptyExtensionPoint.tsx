import { PluginExtensionPoints } from '@grafana/data';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import PageLoader from 'app/core/components/PageLoader/PageLoader';

interface DashboardEmptyExtensionPointProps {
  renderDefaultUI: () => JSX.Element;
  onAddVisualization?: () => void;
  onAddLibraryPanel?: () => void;
  onImportDashboard?: () => void;
}

export function DashboardEmptyExtensionPoint(props: DashboardEmptyExtensionPointProps): JSX.Element | null {
  if (config.featureToggles.enableDashboardEmptyExtensions !== true) {
    return props.renderDefaultUI();
  }

  return <InternalDashboardEmptyExtensionPoint {...props} />;
}

// We have this "internal" component so we can prevent pre-loading the plugins associated with the extension-point if the feature is not enabled.
function InternalDashboardEmptyExtensionPoint(props: DashboardEmptyExtensionPointProps): JSX.Element | null {
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
      pluginId: 'grafana-setupguide-app',
    }) ?? props.renderDefaultUI()
  );
}
