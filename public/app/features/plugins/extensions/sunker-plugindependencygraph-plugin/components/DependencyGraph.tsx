import React, { useEffect, useMemo, useState } from 'react';

import { useTheme2 } from '@grafana/ui';

import { GraphData, PanelOptions } from '../types';


import { ArrowMarkers } from './ArrowMarkers';
import { ContextMenu } from './ContextMenu';
import { ExtensionPointDrillDown } from './ExtensionPointDrillDown';
import { ExtensionRenderer } from './ExtensionRenderer';
import {
  NodeWithPosition,
  calculateContentHeight,
  calculateLayout,
  getExposedComponentPositions,
  getExtensionPointPositions,
} from './GraphLayout';
import { getGraphStyles } from './GraphStyles';
import { HeaderRenderer } from './HeaderRenderer';
import { LinkRenderer } from './LinkRenderer';
import { NodeRenderer } from './NodeRenderer';
import { ProviderDrillDown } from './ProviderDrillDown';

interface DependencyGraphProps {
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({ data, options, width, height }) => {
  const theme = useTheme2();
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);
  const [selectedExtensionPoint, setSelectedExtensionPoint] = useState<string | null>(null);
  const [selectedExposedComponent, setSelectedExposedComponent] = useState<string | null>(null);
  const [selectedContentConsumer, setSelectedContentConsumer] = useState<string | null>(null);
  const [selectedContentProvider, setSelectedContentProvider] = useState<string | null>(null);

  // Navigation state following Grafana scenes patterns
  const [navigationStack, setNavigationStack] = useState<
    Array<{
      type: 'extension-point' | 'provider';
      id: string;
      title: string;
    }>
  >([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    extensionPointId: string;
  } | null>(null);

  // Highlight state for arrows
  const [highlightedExtensionPoint, setHighlightedExtensionPoint] = useState<string | null>(null);

  const isExposeMode = options.visualizationMode === 'expose';
  const styles = getGraphStyles(theme);

  // Debug logging
  console.log('DependencyGraph props:', { width, height, nodesCount: data.nodes.length });

  // Memoized layout calculation
  const layoutNodes = useMemo(() => calculateLayout(data, options, width, height), [data, options, width, height]);

  // Memoized position calculations
  const extensionPointPositions = useMemo(
    () => getExtensionPointPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const exposedComponentPositions = useMemo(
    () => getExposedComponentPositions(data, options, width, height, isExposeMode),
    [data, options, width, height, isExposeMode]
  );

  const contentHeight = useMemo(() => {
    const calculatedHeight = calculateContentHeight(data, options, width, height, isExposeMode);
    // For full height behavior, use the calculated height if it's larger than the available height
    // This allows the content to expand beyond the viewport and make the page scrollable
    return calculatedHeight;
  }, [data, options, width, height, isExposeMode]);

  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes]);

  // Event handlers - removed old selection behavior since we now use context menu

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
    // Clear extension point selection when selecting a provider
    if (id !== null && selectedExtensionPoint !== null) {
      setSelectedExtensionPoint(null);
    }
  };

  // Context menu and drill-down handlers
  const handleExtensionPointClick = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();
    console.log('handleExtensionPointClick called with:', extensionPointId);

    // Only show context menu in add mode
    if (options.visualizationMode === 'add') {
      console.log('Setting context menu at:', event.clientX, event.clientY);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        extensionPointId,
      });
    }
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleExploreExtensionPoint = () => {
    if (contextMenu) {
      const extensionPoint = data.extensionPoints.find((ep) => ep.id === contextMenu.extensionPointId);
      if (extensionPoint) {
        setNavigationStack([
          {
            type: 'extension-point',
            id: extensionPoint.id,
            title: extensionPoint.title || extensionPoint.id,
          },
        ]);
      }
      setContextMenu(null);
    }
  };

  const handleHighlightArrows = () => {
    if (contextMenu) {
      setHighlightedExtensionPoint(contextMenu.extensionPointId);
      setContextMenu(null);
    }
  };

  const handleClearHighlight = () => {
    setHighlightedExtensionPoint(null);
  };

  const handleNavigateToProvider = (providerId: string) => {
    const provider = data.nodes.find((node) => node.id === providerId);
    if (provider) {
      setNavigationStack((prev) => [
        ...prev,
        {
          type: 'provider',
          id: provider.id,
          title: provider.name,
        },
      ]);
    }
  };

  const handleBackFromDrillDown = () => {
    setNavigationStack((prev) => prev.slice(0, -1));
  };

  const handleBackToMainView = () => {
    setNavigationStack([]);
  };

  // Get current drill-down context
  const currentDrillDown = navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null;

  // Empty state check
  if (!data.nodes.length) {
    return (
      <div className={styles.emptyState}>
        <p>No plugin dependency data available</p>
        <p>Configure your data source to provide plugin relationships</p>
        <p>
          Debug: width={width}, height={height}, data keys: {Object.keys(data).join(', ')}
        </p>
      </div>
    );
  }

  // Show drill-down view if we're in navigation mode
  if (currentDrillDown && currentDrillDown.type === 'extension-point') {
    const extensionPoint = data.extensionPoints.find((ep) => ep.id === currentDrillDown.id);
    if (extensionPoint) {
      return (
        <ExtensionPointDrillDown
          extensionPoint={extensionPoint}
          data={data}
          options={options}
          width={width}
          height={height}
          onBack={navigationStack.length > 1 ? handleBackFromDrillDown : handleBackToMainView}
          onNavigateToProvider={handleNavigateToProvider}
        />
      );
    }
  }

  // Show provider drill-down view
  if (currentDrillDown && currentDrillDown.type === 'provider') {
    const provider = data.nodes.find((node) => node.id === currentDrillDown.id);
    if (provider) {
      return (
        <ProviderDrillDown
          provider={provider}
          data={data}
          options={options}
          width={width}
          height={height}
          onBack={navigationStack.length > 1 ? handleBackFromDrillDown : handleBackToMainView}
        />
      );
    }
  }

  return (
    <div className={styles.container}>
      <svg width={width} height={contentHeight} className={styles.svg}>
        <ArrowMarkers theme={theme} />

        <HeaderRenderer theme={theme} width={width} isExposeMode={isExposeMode} styles={styles} />

        {/* Drill-down instruction for add mode */}
        {!isExposeMode && (
          <text
            x={width - 20}
            y={25}
            textAnchor="end"
            className="text-xs"
            fill={theme.colors.text.secondary}
            style={{ fontSize: '11px', opacity: 0.8 }}
          >
            Click extension points to explore details
          </text>
        )}

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
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          selectedExtensionPoint={selectedExtensionPoint}
          selectedExposedComponent={selectedExposedComponent}
          onExtensionPointClick={handleExtensionPointClick}
          onExposedComponentClick={handleExposedComponentClick}
          onExtensionPointRightClick={handleExtensionPointClick}
          styles={styles}
        />

        <LinkRenderer
          theme={theme}
          data={data}
          nodes={nodes}
          extensionPointPositions={extensionPointPositions}
          exposedComponentPositions={exposedComponentPositions}
          width={width}
          isExposeMode={isExposeMode}
          selectedExtensionPoint={selectedExtensionPoint}
          selectedExposedComponent={selectedExposedComponent}
          selectedContentConsumer={selectedContentConsumer}
          selectedContentProvider={selectedContentProvider}
          highlightedExtensionPoint={highlightedExtensionPoint}
          styles={styles}
        />
      </svg>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleContextMenuClose}
          onExploreExtensionPoint={handleExploreExtensionPoint}
          onHighlightArrows={handleHighlightArrows}
        />
      )}

      {/* Clear highlight button */}
      {highlightedExtensionPoint && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
          }}
        >
          <button
            onClick={handleClearHighlight}
            style={{
              padding: '8px 12px',
              backgroundColor: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border.strong}`,
              borderRadius: theme.shape.borderRadius(1),
              color: theme.colors.text.primary,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Clear Highlight
          </button>
        </div>
      )}
    </div>
  );
};
