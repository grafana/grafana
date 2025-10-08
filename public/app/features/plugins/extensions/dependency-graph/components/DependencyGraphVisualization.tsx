import AutoSizer from 'react-virtualized-auto-sizer';
import { DependencyGraph } from '../dependency-graph-panel/components/DependencyGraph';
import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
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
  const { visualizationMode, selectedContentProviders, selectedContentConsumers, selectedExtensionPoints } = controls;

  const { graphData } = useDependencyGraphData({
    visualizationMode,
    selectedContentProviders,
    selectedContentConsumers,
    selectedExtensionPoints,
  });

  return (
    <div style={{ flex: 1, overflow: 'visible', minHeight: LAYOUT_CONSTANTS.MIN_HEIGHT, width: '100%' }}>
      <AutoSizer disableHeight={visualizationMode !== 'extensionpoint'}>
        {({ width, height }) => {
          const effectiveWidth = width || LAYOUT_CONSTANTS.FALLBACK_WIDTH;
          // For extension point mode, use dynamic height. For other modes, use a large fixed height
          const effectiveHeight =
            visualizationMode === 'extensionpoint'
              ? height || LAYOUT_CONSTANTS.MIN_HEIGHT
              : LAYOUT_CONSTANTS.LARGE_HEIGHT;
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
    </div>
  );
}
