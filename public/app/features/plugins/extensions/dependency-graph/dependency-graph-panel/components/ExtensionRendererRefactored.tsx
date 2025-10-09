/**
 * Extension Renderer Component (Refactored)
 *
 * Renders extension points and exposed components in the dependency graph.
 * This is a refactored version that uses smaller, focused components.
 */

import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { GraphData, PanelOptions } from '../types';

import { ContentConsumersRenderer } from './ContentConsumersRenderer';
import { ExposedComponentsRenderer } from './ExposedComponentsRenderer';
import { ExtensionContextMenu } from './ExtensionContextMenu';
import { ExtensionPointModeRenderer } from './ExtensionPointModeRenderer';

interface ExtensionRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
  extensionPointPositions: Map<string, { x: number; y: number; groupY: number; groupHeight: number }>;
  exposedComponentPositions: Map<string, { x: number; y: number; groupY: number; groupHeight: number }>;
  extensionPositions: Map<string, { x: number; y: number; groupY: number; groupHeight: number }>;
  extensionPointModePositions: Map<string, { x: number; y: number; groupY: number; groupHeight: number }>;
  selectedExposedComponent: string | null;
  selectedContentConsumer: string | null;
  highlightedExtensionPointId: string | null;
  onExposedComponentClick: (id: string | null) => void;
  onContentConsumerClick: (id: string | null) => void;
  onContentProviderClick: (id: string | null) => void;
  onHighlightedExtensionPointChange: (id: string | null) => void;
  styles: Record<string, { toString(): string }>;
}

/**
 * Refactored Extension Renderer that uses smaller, focused components
 */
export const ExtensionRendererRefactored: React.FC<ExtensionRendererProps> = ({
  theme,
  data,
  options,
  width,
  height,
  isExposeMode,
  isExtensionPointMode,
  extensionPointPositions,
  exposedComponentPositions,
  extensionPositions,
  extensionPointModePositions,
  selectedExposedComponent,
  selectedContentConsumer,
  highlightedExtensionPointId,
  onExposedComponentClick,
  onContentConsumerClick,
  onContentProviderClick,
  onHighlightedExtensionPointChange,
  styles,
}) => {
  // Context menu state
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedExtensionPointId, setSelectedExtensionPointId] = useState<string | null>(null);

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedExtensionPointId(extensionPointId);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuOpen(true);
  };

  const handleContextMenuClose = () => {
    setContextMenuOpen(false);
    setSelectedExtensionPointId(null);
  };

  const handleHighlightArrows = () => {
    if (selectedExtensionPointId) {
      onHighlightedExtensionPointChange(
        highlightedExtensionPointId === selectedExtensionPointId ? null : selectedExtensionPointId
      );
    }
    handleContextMenuClose();
  };

  const handleNavigateToExtensionPoint = () => {
    if (selectedExtensionPointId) {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('view', 'extensionpoint');
      currentUrl.searchParams.set('extensionPoints', selectedExtensionPointId);
      locationService.push(currentUrl.pathname + currentUrl.search);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    handleContextMenuClose();
  };

  const handleFilterExtensionPoint = () => {
    if (selectedExtensionPointId) {
      const currentUrl = new URL(window.location.href);
      const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
      if (!currentExtensionPoints.includes(selectedExtensionPointId)) {
        currentExtensionPoints.push(selectedExtensionPointId);
        currentUrl.searchParams.set('extensionPoints', currentExtensionPoints.join(','));
        locationService.push(currentUrl.pathname + currentUrl.search);
      }
    }
    handleContextMenuClose();
  };

  const handleUnfilterExtensionPoint = () => {
    if (selectedExtensionPointId) {
      const currentUrl = new URL(window.location.href);
      const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
      const updatedExtensionPoints = currentExtensionPoints.filter((ep) => ep !== selectedExtensionPointId);

      if (updatedExtensionPoints.length > 0) {
        currentUrl.searchParams.set('extensionPoints', updatedExtensionPoints.join(','));
      } else {
        currentUrl.searchParams.delete('extensionPoints');
      }
      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleContextMenuClose();
  };

  // Content consumer context menu handlers
  const handleContentConsumerContextMenu = (event: React.MouseEvent, consumerId: string) => {
    event.preventDefault();
    event.stopPropagation();
    // Implementation for content consumer context menu
  };

  if (isExposeMode) {
    return (
      <>
        <g>
          <ExposedComponentsRenderer
            theme={theme}
            data={data}
            options={options}
            width={width}
            height={height}
            exposedComponentPositions={exposedComponentPositions}
            selectedExposedComponent={selectedExposedComponent}
            onExposedComponentClick={onExposedComponentClick}
            styles={styles}
          />
          <ContentConsumersRenderer
            theme={theme}
            data={data}
            options={options}
            width={width}
            height={height}
            selectedContentConsumer={selectedContentConsumer}
            onContentConsumerClick={onContentConsumerClick}
            onContentConsumerContextMenu={handleContentConsumerContextMenu}
            styles={styles}
          />
        </g>
        <ExtensionContextMenu
          isOpen={contextMenuOpen}
          position={contextMenuPosition}
          selectedExtensionPointId={selectedExtensionPointId}
          data={data}
          onClose={handleContextMenuClose}
          onHighlightArrows={handleHighlightArrows}
          onNavigateToExtensionPoint={handleNavigateToExtensionPoint}
          onFilterExtensionPoint={handleFilterExtensionPoint}
          onUnfilterExtensionPoint={handleUnfilterExtensionPoint}
        />
      </>
    );
  } else if (isExtensionPointMode) {
    return (
      <>
        <ExtensionPointModeRenderer
          theme={theme}
          data={data}
          options={options}
          width={width}
          height={height}
          extensionPointModePositions={extensionPointModePositions}
          selectedContentConsumer={selectedContentConsumer}
          highlightedExtensionPointId={highlightedExtensionPointId}
          onContentConsumerClick={onContentConsumerClick}
          onHighlightedExtensionPointChange={onHighlightedExtensionPointChange}
          onContextMenu={handleContextMenu}
          styles={styles}
        />
        <ExtensionContextMenu
          isOpen={contextMenuOpen}
          position={contextMenuPosition}
          selectedExtensionPointId={selectedExtensionPointId}
          data={data}
          onClose={handleContextMenuClose}
          onHighlightArrows={handleHighlightArrows}
          onNavigateToExtensionPoint={handleNavigateToExtensionPoint}
          onFilterExtensionPoint={handleFilterExtensionPoint}
          onUnfilterExtensionPoint={handleUnfilterExtensionPoint}
        />
      </>
    );
  }

  // For other modes, return a placeholder for now
  return <g />;
};
