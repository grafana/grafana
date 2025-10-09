/**
 * Node Renderer Component (Refactored)
 *
 * Main entry point for node rendering. This file now imports
 * from focused modules for better organization and maintainability.
 */

import { SerializedStyles } from '@emotion/react';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { locationService } from '@grafana/runtime';

import { GraphData } from '../types';

import { NodeWithPosition } from './GraphLayout';
import { ContentProviderContextMenu } from './nodeRendering/ContentProviderContextMenu';
import { NodeRenderingLogic } from './nodeRendering/NodeRenderingLogic';

interface NodeRendererProps {
  theme: GrafanaTheme2;
  nodes: NodeWithPosition[];
  data: GraphData;
  width: number;
  height: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
  selectedContentConsumer: string | null;
  selectedContentProvider: string | null;
  onContentConsumerClick: (id: string | null) => void;
  onContentProviderClick: (id: string | null) => void;
  styles: {
    node: SerializedStyles;
    nodeBox: SerializedStyles;
    appIdLabel: SerializedStyles;
  };
}

export const NodeRendererRefactored: React.FC<NodeRendererProps> = ({
  theme,
  nodes,
  data,
  width,
  height,
  isExposeMode,
  isExtensionPointMode,
  selectedContentConsumer,
  selectedContentProvider,
  onContentConsumerClick,
  onContentProviderClick,
  styles,
}) => {
  // Context menu state for content provider boxes
  const [contentProviderContextMenuOpen, setContentProviderContextMenuOpen] = useState(false);
  const [contentProviderContextMenuPosition, setContentProviderContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedContentProviderId, setSelectedContentProviderId] = useState<string | null>(null);

  // Context menu handlers for content provider boxes
  const handleContentProviderContextMenu = (event: React.MouseEvent, contentProviderId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentConsumerClick(null);
    onContentProviderClick(null);

    setSelectedContentProviderId(contentProviderId);
    setContentProviderContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContentProviderContextMenuOpen(true);
  };

  const handleContentProviderLeftClick = (event: React.MouseEvent, contentProviderId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentConsumerClick(null);
    onContentProviderClick(null);

    setSelectedContentProviderId(contentProviderId);
    setContentProviderContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContentProviderContextMenuOpen(true);
  };

  const handleContentProviderContextMenuClose = () => {
    setContentProviderContextMenuOpen(false);
    setSelectedContentProviderId(null);
  };

  const handleHighlightArrowsToContentProvider = () => {
    if (selectedContentProviderId) {
      onContentProviderClick(selectedContentProviderId);
    }
    handleContentProviderContextMenuClose();
  };

  const handleFilterOnContentProvider = () => {
    if (selectedContentProviderId) {
      // Update URL parameter to filter on content provider
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('contentProviders', selectedContentProviderId);
      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleContentProviderContextMenuClose();
  };

  const handleRemoveContentProviderFilter = () => {
    if (selectedContentProviderId) {
      // Remove the content provider from URL parameters
      const currentUrl = new URL(window.location.href);
      const currentProviders = currentUrl.searchParams.get('contentProviders')?.split(',').filter(Boolean) || [];
      const updatedProviders = currentProviders.filter((provider) => provider !== selectedContentProviderId);

      if (updatedProviders.length > 0) {
        currentUrl.searchParams.set('contentProviders', updatedProviders.join(','));
      } else {
        currentUrl.searchParams.delete('contentProviders');
      }

      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleContentProviderContextMenuClose();
  };

  // Helper function to check if a content provider is already filtered
  const isContentProviderFiltered = (providerId: string): boolean => {
    const currentUrl = new URL(window.location.href);
    const currentProviders = currentUrl.searchParams.get('contentProviders')?.split(',').filter(Boolean) || [];
    return currentProviders.includes(providerId);
  };

  return (
    <>
      <NodeRenderingLogic
        theme={theme}
        nodes={nodes}
        data={data}
        width={width}
        height={height}
        isExposeMode={isExposeMode}
        selectedContentProvider={selectedContentProvider}
        selectedContentConsumer={selectedContentConsumer}
        onContentConsumerClick={onContentConsumerClick}
        onContentProviderLeftClick={handleContentProviderLeftClick}
        onContentProviderContextMenu={handleContentProviderContextMenu}
      />
      <ContentProviderContextMenu
        isOpen={contentProviderContextMenuOpen}
        position={contentProviderContextMenuPosition}
        selectedContentProviderId={selectedContentProviderId}
        onClose={handleContentProviderContextMenuClose}
        onHighlightArrows={handleHighlightArrowsToContentProvider}
        onFilter={handleFilterOnContentProvider}
        onRemoveFilter={handleRemoveContentProviderFilter}
        isFiltered={isContentProviderFiltered}
      />
    </>
  );
};
