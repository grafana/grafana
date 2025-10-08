import AutoSizer from 'react-virtualized-auto-sizer';

import { DependencyGraph } from '../dependency-graph-panel/components/DependencyGraph';
import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';
import { logAutoSizer } from '../utils/logger';

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
  const {
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
  } = controls;

  const { graphData } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedContentConsumersForExtensionPoint,
    selectedExtensionPoints,
  });

  return (
    <div style={{ flex: 1, overflow: 'visible', minHeight: LAYOUT_CONSTANTS.MIN_HEIGHT, width: '100%' }}>
      {visualizationMode === 'extensionpoint' ? (
        <AutoSizer>
          {({ width, height }: { width: number; height: number }) => {
            const effectiveWidth = width || LAYOUT_CONSTANTS.FALLBACK_WIDTH;
            const effectiveHeight = height || LAYOUT_CONSTANTS.MIN_HEIGHT;
            logAutoSizer(effectiveWidth, effectiveHeight);
            return (
              <div style={{ width: effectiveWidth, height: effectiveHeight }}>
                <DependencyGraph
                  data={graphData}
                  options={{
                    visualizationMode,
                    showDependencyTypes: true,
                    showDescriptions: false,
                    selectedContentProviders,
                    selectedContentConsumers,
                    selectedContentConsumersForExtensionPoint,
                    selectedExtensionPoints,
                    linkExtensionColor: '#37872d',
                    componentExtensionColor: '#ff9900',
                    functionExtensionColor: '#e02f44',
                    layoutType: 'hierarchical',
                  }}
                  width={effectiveWidth}
                  height={effectiveHeight}
                />
              </div>
            );
          }}
        </AutoSizer>
      ) : (
        <AutoSizer disableHeight>
          {({ width }: { width: number }) => {
            const effectiveWidth = width || LAYOUT_CONSTANTS.FALLBACK_WIDTH;
            const effectiveHeight = LAYOUT_CONSTANTS.LARGE_HEIGHT;
            logAutoSizer(effectiveWidth, effectiveHeight);
            return (
              <div style={{ width: effectiveWidth, height: effectiveHeight }}>
                <DependencyGraph
                  data={graphData}
                  options={{
                    visualizationMode,
                    showDependencyTypes: true,
                    showDescriptions: false,
                    selectedContentProviders,
                    selectedContentConsumers,
                    selectedContentConsumersForExtensionPoint,
                    selectedExtensionPoints,
                    linkExtensionColor: '#37872d',
                    componentExtensionColor: '#ff9900',
                    functionExtensionColor: '#e02f44',
                    layoutType: 'hierarchical',
                  }}
                  width={effectiveWidth}
                  height={effectiveHeight}
                />
              </div>
            );
          }}
        </AutoSizer>
      )}
    </div>
  );
}
