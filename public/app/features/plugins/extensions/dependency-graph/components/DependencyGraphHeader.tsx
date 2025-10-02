import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import React from 'react';
import { t } from '@grafana/i18n';
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

  return (
    <div>
      <h2>{t('extensions.dependency-graph.title', 'Plugin Dependency Graph')}</h2>
      <p>
        {t(
          'extensions.dependency-graph.description',
          'Visualize plugin dependencies and extension points using Grafana Scenes'
        )}
      </p>
      <p>
        {t(
          'extensions.dependency-graph.stats',
          'Nodes: {{nodes}}, Dependencies: {{dependencies}}, Extension Points: {{extensionPoints}}',
          {
            nodes: graphData.nodes.length,
            dependencies: graphData.dependencies.length,
            extensionPoints: graphData.extensionPoints.length,
          }
        )}
      </p>
    </div>
  );
}
