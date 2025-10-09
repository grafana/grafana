import { css } from '@emotion/css';
import AutoSizer from 'react-virtualized-auto-sizer';

import { useStyles2 } from '@grafana/ui';

import { DependencyGraph } from '../dependency-graph-panel/components/DependencyGraph';
import { LAYOUT_CONSTANTS } from '../dependency-graph-panel/constants';
import { DependencyGraphControls } from '../hooks/useDependencyGraphControls';
import { useDependencyGraphData } from '../hooks/useDependencyGraphData';
import { logAutoSizer } from '../utils/logger';

interface DependencyGraphVisualizationProps {
  controls: DependencyGraphControls;
}

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

  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {visualizationMode === 'extensionpoint' ? (
        <AutoSizer>
          {({ width, height }: { width: number; height: number }) => {
            const effectiveWidth = width || LAYOUT_CONSTANTS.VISUALIZATION_FALLBACK_WIDTH;
            const effectiveHeight = height || LAYOUT_CONSTANTS.VISUALIZATION_MIN_HEIGHT;
            logAutoSizer(effectiveWidth, effectiveHeight);
            return (
              <div className={styles.graphContainer} style={{ width: effectiveWidth, height: effectiveHeight }}>
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
            const effectiveWidth = width || LAYOUT_CONSTANTS.VISUALIZATION_FALLBACK_WIDTH;
            const effectiveHeight = LAYOUT_CONSTANTS.VISUALIZATION_LARGE_HEIGHT;
            logAutoSizer(effectiveWidth, effectiveHeight);
            return (
              <div className={styles.graphContainer} style={{ width: effectiveWidth, height: effectiveHeight }}>
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

const getStyles = () => {
  return {
    container: css({
      flex: 1,
      overflow: 'visible',
      minHeight: LAYOUT_CONSTANTS.VISUALIZATION_MIN_HEIGHT,
      width: '100%',
    }),
    graphContainer: css({
      // Additional styles can be added here if needed
    }),
  };
};
