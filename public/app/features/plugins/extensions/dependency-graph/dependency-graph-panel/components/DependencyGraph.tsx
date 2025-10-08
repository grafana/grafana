import React, { useEffect, useMemo, useState } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { GraphData, PanelOptions } from '../types';

import { ArrowMarkers } from './ArrowMarkers';
import { ExtensionRenderer } from './ExtensionRenderer';
import {
  NodeWithPosition,
  calculateContentHeight,
  calculateLayout,
  getExposedComponentPositions,
  getExtensionPointModePositions,
  getExtensionPointPositions,
  getExtensionPositions,
} from './GraphLayout';
import { getGraphStyles } from './GraphStyles';
import { HeaderRenderer } from './HeaderRenderer';
import { LinkRenderer } from './LinkRenderer';
import { NodeRenderer } from './NodeRenderer';

interface DependencyGraphProps {
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, options, width, height }) => {
  const theme = useTheme2();
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);
  const [selectedExposedComponent, setSelectedExposedComponent] = useState<string | null>(null);
  const [selectedContentConsumer, setSelectedContentConsumer] = useState<string | null>(null);
  const [selectedContentProvider, setSelectedContentProvider] = useState<string | null>(null);

  const isExposeMode = options.visualizationMode === 'expose';
  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';
  const styles = getGraphStyles(theme);

  // Debug logging
  console.log('DependencyGraph props:', { width, height, nodesCount: data.nodes.length });

  // Memoized layout calculation
  const layoutNodes = useMemo(() => calculateLayout(data, options, width, height), [data, options, width, height]);

  // Position calculations are now handled by the unified renderer

  const contentHeight = useMemo(() => {
    const calculatedHeight = calculateContentHeight(data, options, width, height, isExposeMode || isExtensionPointMode);
    // For full height behavior, use the calculated height if it's larger than the available height
    // This allows the content to expand beyond the viewport and make the page scrollable
    return calculatedHeight;
  }, [data, options, width, height, isExposeMode, isExtensionPointMode]);

  // Memoized position calculations
  const extensionPointPositions = useMemo(
    () => getExtensionPointPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const exposedComponentPositions = useMemo(
    () => getExposedComponentPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const extensionPositions = useMemo(
    () => getExtensionPositions(data, options, width, height, isExtensionPointMode),
    [data, options, width, height, isExtensionPointMode]
  );

  const extensionPointModePositions = useMemo(
    () => getExtensionPointModePositions(data, options, width, height, isExtensionPointMode),
    [data, options, width, height, isExtensionPointMode]
  );

  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes]);

  const handleExposedComponentClick = (id: string | null) => {
    setSelectedExposedComponent(selectedExposedComponent === id ? null : id);
    // Clear consumer selection when selecting an exposed component
    if (id !== null && selectedContentConsumer !== null) {
      setSelectedContentConsumer(null);
    }
  };

  const handleContentConsumerClick = (id: string | null) => {
    setSelectedContentConsumer(selectedContentConsumer === id ? null : id);
    // Clear exposed component selection when selecting a consumer
    if (id !== null && selectedExposedComponent !== null) {
      setSelectedExposedComponent(null);
    }
  };

  const handleContentProviderClick = (id: string | null) => {
    setSelectedContentProvider(selectedContentProvider === id ? null : id);
  };

  // Empty state check
  if (!data.nodes.length) {
    return (
      <div className={styles.emptyState.toString()}>
        <p>{t('extensions.dependency-graph.no-data', 'No plugin dependency data available')}</p>
        <p>
          {t(
            'extensions.dependency-graph.configure-data-source',
            'Configure your data source to provide plugin relationships'
          )}
        </p>
        <p>
          {t(
            'extensions.dependency-graph.debug-info',
            'Debug: width={{width}}, height={{height}}, data keys: {{keys}}',
            {
              width,
              height,
              keys: Object.keys(data).join(', '),
            }
          )}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container.toString()}>
      <svg width={width} height={contentHeight}>
        <ArrowMarkers theme={theme} />

        <HeaderRenderer
          theme={theme}
          width={width}
          isExposeMode={isExposeMode}
          isExtensionPointMode={isExtensionPointMode}
          styles={styles}
        />

        <NodeRenderer
          theme={theme}
          nodes={nodes}
          data={data}
          width={width}
          height={height}
          isExposeMode={isExposeMode}
          selectedContentConsumer={selectedContentConsumer}
          selectedContentProvider={selectedContentProvider}
          onContentConsumerClick={handleContentConsumerClick}
          onContentProviderClick={handleContentProviderClick}
          styles={styles}
        />

        <ExtensionRenderer
          theme={theme}
          data={data}
          options={options}
          width={width}
          height={height}
          isExposeMode={isExposeMode}
          isExtensionPointMode={isExtensionPointMode}
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          extensionPositions={extensionPositions}
          extensionPointModePositions={extensionPointModePositions}
          selectedExposedComponent={selectedExposedComponent}
          selectedContentConsumer={selectedContentConsumer}
          onExposedComponentClick={handleExposedComponentClick}
          onContentConsumerClick={handleContentConsumerClick}
          styles={styles}
        />

        <LinkRenderer
          theme={theme}
          data={data}
          nodes={nodes}
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          extensionPositions={extensionPositions}
          extensionPointModePositions={extensionPointModePositions}
          width={width}
          isExposeMode={isExposeMode}
          isExtensionPointMode={isExtensionPointMode}
          selectedExposedComponent={selectedExposedComponent}
          selectedContentConsumer={selectedContentConsumer}
          selectedContentProvider={selectedContentProvider}
          styles={styles}
        />
      </svg>
    </div>
  );
};
