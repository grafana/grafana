import AutoSizer from 'react-virtualized-auto-sizer';
import { DependencyGraph } from '../../sunker-plugindependencygraph-plugin/components/DependencyGraph';
import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import React from 'react';
import { logAutoSizer } from '../utils/logger';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';

interface DependencyGraphVisualizationProps {
  controls: DependencyGraphControls;
}

// Layout constants
const LAYOUT_CONSTANTS = {
  MIN_HEIGHT: 500,
  FALLBACK_WIDTH: 1200,
  LARGE_HEIGHT: 2000,
} as const;

/**
 * Reusable component for rendering the dependency graph visualization
 */
export function DependencyGraphVisualization({ controls }: DependencyGraphVisualizationProps): JSX.Element {
  const { visualizationMode, selectedContentProviders, selectedContentConsumers } = controls;

  const { graphData } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
  });

  return (
    <div style={{ flex: 1, overflow: 'visible', minHeight: LAYOUT_CONSTANTS.MIN_HEIGHT, width: '100%' }}>
      <AutoSizer disableHeight>
        {({ width }) => {
          const effectiveWidth = width || LAYOUT_CONSTANTS.FALLBACK_WIDTH;
          logAutoSizer(effectiveWidth);
          return (
            <div style={{ width: effectiveWidth, minHeight: LAYOUT_CONSTANTS.MIN_HEIGHT }}>
              <DependencyGraph
                data={graphData}
                options={{
                  visualizationMode,
                  showDependencyTypes: true,
                  showDescriptions: false,
                  selectedContentProviders,
                  selectedContentConsumers,
                  linkExtensionColor: '#37872d',
                  componentExtensionColor: '#ff9900',
                  functionExtensionColor: '#e02f44',
                }}
                width={effectiveWidth}
                height={LAYOUT_CONSTANTS.LARGE_HEIGHT}
              />
            </div>
          );
        }}
      </AutoSizer>
    </div>
  );
}
