import { t } from '@grafana/i18n';

import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';

interface DependencyGraphHeaderProps {
  controls: DependencyGraphControls;
}

/**
 * Reusable component for the dependency graph header with statistics
 */
export function DependencyGraphHeader({ controls }: DependencyGraphHeaderProps): JSX.Element {
  const { visualizationMode, selectedContentProviders, selectedContentConsumers } = controls;

  const { graphData } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
  });

  return <div></div>;
}
