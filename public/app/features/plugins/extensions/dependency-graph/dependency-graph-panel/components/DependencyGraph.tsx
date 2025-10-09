import { useEffect, useState } from 'react';

import { Spinner, useTheme2 } from '@grafana/ui';

import { useDependencyGraphEventHandlers } from '../hooks/useDependencyGraphEventHandlers';
import { useDependencyGraphPositions } from '../hooks/useDependencyGraphPositions';
import { useDependencyGraphState } from '../hooks/useDependencyGraphState';
import { GraphData, PanelOptions } from '../types';

import { ArrowMarkers } from './ArrowMarkers';
import { EmptyState } from './EmptyState';
import { ExtensionRenderer } from './ExtensionRenderer';
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

export function DependencyGraph({ data, options, width, height }: DependencyGraphProps) {
  const theme = useTheme2();
  const styles = getGraphStyles(theme);
  const [isLoading, setIsLoading] = useState(true);

  const isExposeMode = options.visualizationMode === 'exposedComponents';
  const isExtensionPointMode = options.visualizationMode === 'extensionpoint';

  // Debug logging
  console.log('DependencyGraph props:', { width, height, nodesCount: data.nodes.length });

  // Use custom hooks for state management, event handlers, and position calculations
  const {
    nodes,
    selectedExposedComponent,
    selectedContentConsumer,
    selectedContentProvider,
    highlightedExtensionPointId,
    setNodes,
    setSelectedExposedComponent,
    setSelectedContentConsumer,
    setSelectedContentProvider,
    setHighlightedExtensionPointId,
  } = useDependencyGraphState();

  const {
    layoutNodes,
    contentHeight,
    extensionPointPositions,
    exposedComponentPositions,
    extensionPositions,
    extensionPointModePositions,
  } = useDependencyGraphPositions({
    data,
    options,
    width,
    height,
    isExposeMode,
    isExtensionPointMode,
  });

  const {
    handleExposedComponentClick,
    handleContentConsumerClick,
    handleContentProviderClick,
    handleHighlightedExtensionPointChange,
    handleSvgClick,
  } = useDependencyGraphEventHandlers({
    selectedExposedComponent,
    selectedContentConsumer,
    selectedContentProvider,
    highlightedExtensionPointId,
    setSelectedExposedComponent,
    setSelectedContentConsumer,
    setSelectedContentProvider,
    setHighlightedExtensionPointId,
  });

  useEffect(() => {
    setNodes(layoutNodes);
    // Simulate loading time for better UX
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [layoutNodes, setNodes]);

  // Loading state
  if (isLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}
      >
        <Spinner size="lg" />
      </div>
    );
  }

  // Empty state check
  if (!data.nodes.length) {
    return <EmptyState data={data} width={width} height={height} styles={styles} />;
  }

  return (
    <div className={styles.container.toString()}>
      <svg width={width} height={contentHeight} onClick={handleSvgClick}>
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
          isExtensionPointMode={isExtensionPointMode}
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
          extensionPointsPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          extensionPositions={extensionPositions}
          extensionPointsModePositions={extensionPointModePositions}
          selectedExposedComponent={selectedExposedComponent}
          selectedContentConsumer={selectedContentConsumer}
          highlightedExtensionPointId={highlightedExtensionPointId}
          onExposedComponentClick={handleExposedComponentClick}
          onContentConsumerClick={handleContentConsumerClick}
          onContentProviderClick={handleContentProviderClick}
          onHighlightedExtensionPointChange={handleHighlightedExtensionPointChange}
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
          highlightedExtensionPointId={highlightedExtensionPointId}
          styles={styles}
        />
      </svg>
    </div>
  );
}
