/**
 * Extension Renderer Component
 *
 * Renders extension points and exposed components in the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React, { useState } from 'react';
import semver from 'semver';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { ContextMenu, Menu } from '@grafana/ui';

import {
  COLOR_DEFAULTS,
  DISPLAY_NAMES,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveGroupSpacing,
  getRightMargin,
} from '../constants';
import { GraphData, PanelOptions } from '../types';

import { PositionInfo } from './GraphLayout';

/**
 * Polishes version strings by removing build metadata and pre-release identifiers
 */
function polishVersion(version: string): string {
  try {
    // Remove 'v' prefix if present for semver parsing
    const cleanVersion = version.startsWith('v') ? version.slice(1) : version;

    // Parse with semver to extract major.minor.patch
    const parsed = semver.parse(cleanVersion);
    if (parsed) {
      // Return only major.minor.patch, ignoring pre-release and build metadata
      return `v${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }

    // Fallback: if semver parsing fails, try to extract just the version numbers
    const versionMatch = cleanVersion.match(/^(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return `v${versionMatch[1]}`;
    }

    // If all else fails, return original version
    return version;
  } catch {
    // If all else fails, return original version
    return version;
  }
}

interface ExtensionRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  extensionPositions: Map<string, PositionInfo>;
  extensionPointModePositions: Map<string, PositionInfo>;
  selectedExposedComponent: string | null;
  selectedContentConsumer: string | null;
  highlightedExtensionPointId: string | null;
  onExposedComponentClick: (id: string | null) => void;
  onContentConsumerClick: (id: string | null) => void;
  onContentProviderClick: (id: string | null) => void;
  onHighlightedExtensionPointChange: (id: string | null) => void;
  styles: {
    extensionGroupBox: SerializedStyles;
    extensionPointBox: SerializedStyles;
    extensionPointLabel: SerializedStyles;
    extensionTypeBadge: SerializedStyles;
    definingPluginLabel: SerializedStyles;
    descriptionInlineText: SerializedStyles;
  };
}

export const ExtensionRenderer: React.FC<ExtensionRendererProps> = ({
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

  // Content consumer context menu state
  const [contentConsumerContextMenuOpen, setContentConsumerContextMenuOpen] = useState(false);
  const [contentConsumerContextMenuPosition, setContentConsumerContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedContentConsumerId, setSelectedContentConsumerId] = useState<string | null>(null);

  // Context menu handlers
  const handleContextMenu = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedExtensionPointId(extensionPointId);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContextMenuOpen(true);
  };

  const handleLeftClick = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
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

  // Content consumer context menu handlers
  const handleContentConsumerContextMenu = (event: React.MouseEvent, contentConsumerId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedContentConsumerId(contentConsumerId);
    setContentConsumerContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContentConsumerContextMenuOpen(true);
  };

  const handleContentConsumerLeftClick = (event: React.MouseEvent, contentConsumerId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedContentConsumerId(contentConsumerId);
    setContentConsumerContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContentConsumerContextMenuOpen(true);
  };

  const handleContentConsumerContextMenuClose = () => {
    setContentConsumerContextMenuOpen(false);
    setSelectedContentConsumerId(null);
  };

  const handleHighlightArrowsToContentConsumer = () => {
    if (selectedContentConsumerId) {
      onContentConsumerClick(selectedContentConsumerId);
    }
    handleContentConsumerContextMenuClose();
  };

  const handleFilterOnContentConsumer = () => {
    if (selectedContentConsumerId) {
      // Update URL parameter to filter on content consumer
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('contentConsumers', selectedContentConsumerId);
      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleContentConsumerContextMenuClose();
  };

  const handleRemoveContentConsumerFilter = () => {
    if (selectedContentConsumerId) {
      // Remove the content consumer from URL parameters
      const currentUrl = new URL(window.location.href);
      const currentConsumers = currentUrl.searchParams.get('contentConsumers')?.split(',').filter(Boolean) || [];
      const updatedConsumers = currentConsumers.filter((consumer) => consumer !== selectedContentConsumerId);

      if (updatedConsumers.length > 0) {
        currentUrl.searchParams.set('contentConsumers', updatedConsumers.join(','));
      } else {
        currentUrl.searchParams.delete('contentConsumers');
      }

      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleContentConsumerContextMenuClose();
  };

  // Content provider context menu handlers (for expose mode left side)
  const [contentProviderContextMenuOpen, setContentProviderContextMenuOpen] = useState(false);
  const [contentProviderContextMenuPosition, setContentProviderContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedContentProviderId, setSelectedContentProviderId] = useState<string | null>(null);

  // Extension point context menu handlers (for extension point mode right side)
  const [extensionPointContextMenuOpen, setExtensionPointContextMenuOpen] = useState(false);
  const [extensionPointContextMenuPosition, setExtensionPointContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedExtensionPointForFilter, setSelectedExtensionPointForFilter] = useState<string | null>(null);

  // Individual extension context menu handlers (for extension point mode left side)
  const [extensionContextMenuOpen, setExtensionContextMenuOpen] = useState(false);
  const [selectedExtensionId, setSelectedExtensionId] = useState<string | null>(null);

  const handleContentProviderContextMenu = (event: React.MouseEvent, contentProviderId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedContentProviderId(contentProviderId);
    setContentProviderContextMenuPosition({ x: event.clientX, y: event.clientY });
    setContentProviderContextMenuOpen(true);
  };

  const handleContentProviderLeftClick = (event: React.MouseEvent, contentProviderId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

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

  // Helper functions to check if an app is already filtered
  const isContentConsumerFiltered = (consumerId: string): boolean => {
    const currentUrl = new URL(window.location.href);
    const currentConsumers = currentUrl.searchParams.get('contentConsumers')?.split(',').filter(Boolean) || [];
    return currentConsumers.includes(consumerId);
  };

  const isContentProviderFiltered = (providerId: string): boolean => {
    const currentUrl = new URL(window.location.href);
    const currentProviders = currentUrl.searchParams.get('contentProviders')?.split(',').filter(Boolean) || [];
    return currentProviders.includes(providerId);
  };

  // Extension point context menu handlers
  const handleExtensionPointContextMenu = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedExtensionPointForFilter(extensionPointId);
    setExtensionPointContextMenuPosition({ x: event.clientX, y: event.clientY });
    setExtensionPointContextMenuOpen(true);
  };

  const handleExtensionPointLeftClick = (event: React.MouseEvent, extensionPointId: string) => {
    event.preventDefault();
    event.stopPropagation();

    // Immediately clear any existing highlighting/selections
    onContentProviderClick(null);
    onContentConsumerClick(null);
    onHighlightedExtensionPointChange(null);

    setSelectedExtensionPointForFilter(extensionPointId);
    setExtensionPointContextMenuPosition({ x: event.clientX, y: event.clientY });
    setExtensionPointContextMenuOpen(true);
  };

  const handleExtensionPointContextMenuClose = () => {
    setExtensionPointContextMenuOpen(false);
    setSelectedExtensionPointForFilter(null);
  };

  const handleFilterOnExtensionPoint = () => {
    if (selectedExtensionPointForFilter) {
      // Update URL parameter to filter on extension point
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('extensionPoints', selectedExtensionPointForFilter);
      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleExtensionPointContextMenuClose();
  };

  const handleRemoveExtensionPointFilter = () => {
    if (selectedExtensionPointForFilter) {
      // Remove the extension point from URL parameters
      const currentUrl = new URL(window.location.href);
      const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
      const updatedExtensionPoints = currentExtensionPoints.filter((ep) => ep !== selectedExtensionPointForFilter);

      if (updatedExtensionPoints.length > 0) {
        currentUrl.searchParams.set('extensionPoints', updatedExtensionPoints.join(','));
      } else {
        currentUrl.searchParams.delete('extensionPoints');
      }

      locationService.push(currentUrl.pathname + currentUrl.search);
    }
    handleExtensionPointContextMenuClose();
  };

  // Helper function to check if an extension point is already filtered
  const isExtensionPointFiltered = (extensionPointId: string): boolean => {
    const currentUrl = new URL(window.location.href);
    const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
    return currentExtensionPoints.includes(extensionPointId);
  };

  // Individual extension context menu handlers

  const handleExtensionContextMenuClose = () => {
    setExtensionContextMenuOpen(false);
    setSelectedExtensionId(null);
  };

  const handleRemoveExtensionFilter = () => {
    if (selectedExtensionId) {
      // Find the extension point that this extension targets
      const extension = data.extensions?.find((ext) => ext.id === selectedExtensionId);
      if (extension) {
        // Remove the extension point from URL parameters
        const currentUrl = new URL(window.location.href);
        const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
        const updatedExtensionPoints = currentExtensionPoints.filter((ep) => ep !== extension.targetExtensionPoint);

        if (updatedExtensionPoints.length > 0) {
          currentUrl.searchParams.set('extensionPoints', updatedExtensionPoints.join(','));
        } else {
          currentUrl.searchParams.delete('extensionPoints');
        }

        locationService.push(currentUrl.pathname + currentUrl.search);
      }
    }
    handleExtensionContextMenuClose();
  };

  // Helper function to check if an extension's target extension point is already filtered
  const isExtensionFiltered = (extensionId: string): boolean => {
    const extension = data.extensions?.find((ext) => ext.id === extensionId);
    if (!extension) {
      return false;
    }
    const currentUrl = new URL(window.location.href);
    const currentExtensionPoints = currentUrl.searchParams.get('extensionPoints')?.split(',').filter(Boolean) || [];
    return currentExtensionPoints.includes(extension.targetExtensionPoint);
  };

  const handleNavigateToExtensionPoint = () => {
    if (selectedExtensionPointId) {
      // Navigate to extension point mode with this specific extension point selected
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('view', 'extensionpoint');
      currentUrl.searchParams.set('extensionPoints', selectedExtensionPointId);
      locationService.push(currentUrl.pathname + currentUrl.search);

      // Scroll to top of the page after navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    handleContextMenuClose();
  };

  const handleHighlightArrows = () => {
    if (selectedExtensionPointId) {
      // Toggle highlighting - if already highlighted, turn off; otherwise highlight
      onHighlightedExtensionPointChange(
        highlightedExtensionPointId === selectedExtensionPointId ? null : selectedExtensionPointId
      );
    }
    handleContextMenuClose();
  };

  // Function to count extensions for each extension point
  const getExtensionCountForExtensionPoint = (extensionPointId: string): number => {
    if (!data.dependencies) {
      return 0;
    }

    // Count dependencies that target this extension point
    return data.dependencies.filter((dep) => dep.target === extensionPointId).length;
  };
  const renderContextMenu = () => {
    if (!contextMenuOpen) {
      return null;
    }

    return (
      <ContextMenu
        x={contextMenuPosition.x}
        y={contextMenuPosition.y}
        onClose={handleContextMenuClose}
        renderMenuItems={() => (
          <>
            <Menu.Item
              label={t('extensions.dependency-graph.see-extensions', 'See extensions that use this extension point')}
              onClick={handleNavigateToExtensionPoint}
              icon="external-link-alt"
            />
            <Menu.Item
              label={t(
                'extensions.dependency-graph.draw-arrows-from-providers',
                'Draw arrows from content providers extending this extension point'
              )}
              onClick={handleHighlightArrows}
              icon="arrow-right"
            />
          </>
        )}
      />
    );
  };

  const renderContentConsumerContextMenu = () => {
    if (!contentConsumerContextMenuOpen || !selectedContentConsumerId) {
      return null;
    }

    const appName = selectedContentConsumerId === 'grafana-core' ? 'Grafana Core' : selectedContentConsumerId;

    return (
      <ContextMenu
        x={contentConsumerContextMenuPosition.x}
        y={contentConsumerContextMenuPosition.y}
        onClose={handleContentConsumerContextMenuClose}
        renderMenuItems={() => (
          <>
            <Menu.Item
              label={t(
                'extensions.dependency-graph.highlight-arrows-associated',
                'Highlight arrows associated with {{appName}}',
                {
                  appName,
                }
              )}
              onClick={handleHighlightArrowsToContentConsumer}
              icon="arrow-right"
            />
            {!isExtensionPointMode && (
              <>
                {isContentConsumerFiltered(selectedContentConsumerId) ? (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.remove-content-consumer-filter',
                      'Remove {{appName}} filter',
                      {
                        appName,
                      }
                    )}
                    onClick={handleRemoveContentConsumerFilter}
                    icon="times"
                  />
                ) : (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.filter-content-consumer',
                      'Filter content consumer by {{appName}}',
                      {
                        appName,
                      }
                    )}
                    onClick={handleFilterOnContentConsumer}
                    icon="filter"
                  />
                )}
              </>
            )}
          </>
        )}
      />
    );
  };

  const renderContentProviderContextMenu = () => {
    if (!contentProviderContextMenuOpen || !selectedContentProviderId) {
      return null;
    }

    const appName = selectedContentProviderId === 'grafana-core' ? 'Grafana Core' : selectedContentProviderId;

    return (
      <ContextMenu
        x={contentProviderContextMenuPosition.x}
        y={contentProviderContextMenuPosition.y}
        onClose={handleContentProviderContextMenuClose}
        renderMenuItems={() => (
          <>
            <Menu.Item
              label={t(
                'extensions.dependency-graph.highlight-arrows-associated',
                'Highlight arrows associated with {{appName}}',
                {
                  appName,
                }
              )}
              onClick={handleHighlightArrowsToContentProvider}
              icon="arrow-right"
            />
            {!isExtensionPointMode && (
              <>
                {isContentProviderFiltered(selectedContentProviderId) ? (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.remove-content-provider-filter',
                      'Remove {{appName}} filter',
                      {
                        appName,
                      }
                    )}
                    onClick={handleRemoveContentProviderFilter}
                    icon="times"
                  />
                ) : (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.filter-content-provider',
                      'Filter content providers by {{appName}}',
                      {
                        appName,
                      }
                    )}
                    onClick={handleFilterOnContentProvider}
                    icon="filter"
                  />
                )}
              </>
            )}
            {isExtensionPointMode && (
              <>
                {isContentProviderFiltered(selectedContentProviderId) ? (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.remove-content-provider-filter',
                      'Remove {{appName}} filter',
                      {
                        appName,
                      }
                    )}
                    onClick={handleRemoveContentProviderFilter}
                    icon="times"
                  />
                ) : (
                  <Menu.Item
                    label={t(
                      'extensions.dependency-graph.filter-content-provider',
                      'Filter content providers by {{appName}}',
                      {
                        appName,
                      }
                    )}
                    onClick={handleFilterOnContentProvider}
                    icon="filter"
                  />
                )}
              </>
            )}
          </>
        )}
      />
    );
  };

  const renderExtensionPointContextMenu = () => {
    if (!extensionPointContextMenuOpen || !selectedExtensionPointForFilter) {
      return null;
    }

    // Shorten the extension point ID for display
    const getShortExtensionPointName = (fullId: string): string => {
      const parts = fullId.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[parts.length - 1]}`;
      }
      return fullId;
    };

    const extensionPointName = getShortExtensionPointName(selectedExtensionPointForFilter);

    return (
      <ContextMenu
        x={extensionPointContextMenuPosition.x}
        y={extensionPointContextMenuPosition.y}
        onClose={handleExtensionPointContextMenuClose}
        renderMenuItems={() => (
          <>
            {isExtensionPointFiltered(selectedExtensionPointForFilter) ? (
              <Menu.Item
                label={t(
                  'extensions.dependency-graph.remove-extension-point-filter',
                  'Remove {{extensionPointName}} filter',
                  {
                    extensionPointName,
                  }
                )}
                onClick={handleRemoveExtensionPointFilter}
                icon="times"
              />
            ) : (
              <Menu.Item
                label={t('extensions.dependency-graph.filter-extension-point', 'Filter on this extension point')}
                onClick={handleFilterOnExtensionPoint}
                icon="filter"
              />
            )}
          </>
        )}
      />
    );
  };

  const renderExtensionContextMenu = () => {
    if (!extensionContextMenuOpen || !selectedExtensionId) {
      return null;
    }

    const extension = data.extensions?.find((ext) => ext.id === selectedExtensionId);
    if (!extension) {
      return null;
    }

    // Shorten the extension point ID for display
    const getShortExtensionPointName = (fullId: string): string => {
      const parts = fullId.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[parts.length - 1]}`;
      }
      return fullId;
    };

    const extensionPointName = getShortExtensionPointName(extension.targetExtensionPoint);

    return (
      <ContextMenu
        x={0}
        y={0}
        onClose={handleExtensionContextMenuClose}
        renderMenuItems={() => (
          <>
            {isExtensionFiltered(selectedExtensionId) ? (
              <Menu.Item
                label={t(
                  'extensions.dependency-graph.remove-extension-point-filter',
                  'Remove {{extensionPointName}} filter',
                  {
                    extensionPointName,
                  }
                )}
                onClick={handleRemoveExtensionFilter}
                icon="times"
              />
            ) : (
              <Menu.Item
                label={t('extensions.dependency-graph.filter-extension-point', 'Filter on this extension point')}
                onClick={handleFilterOnExtensionPoint}
                icon="filter"
              />
            )}
          </>
        )}
      />
    );
  };

  if (isExposeMode) {
    return (
      <>
        <g>
          {renderExposedComponents()}
          {renderContentConsumers()}
        </g>
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
        {renderContentProviderContextMenu()}
      </>
    );
  } else if (isExtensionPointMode) {
    return (
      <>
        {renderExtensionPointMode()}
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
        {renderContentProviderContextMenu()}
        {renderExtensionPointContextMenu()}
        {renderExtensionContextMenu()}
      </>
    );
  } else if (options.visualizationMode === 'addedlinks') {
    // In "Added links" view, render extension points (which are the consumers)
    return (
      <>
        {renderExtensionPoints()}
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
      </>
    );
  } else if (options.visualizationMode === 'addedcomponents') {
    // In "Added components" view, render extension points (which are the consumers)
    return (
      <>
        {renderExtensionPoints()}
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
      </>
    );
  } else if (options.visualizationMode === 'addedfunctions') {
    // In "Added functions" view, render extension points (which are the consumers)
    return (
      <>
        {renderExtensionPoints()}
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
      </>
    );
  } else {
    return (
      <>
        {renderExtensionPoints()}
        {renderContextMenu()}
        {renderContentConsumerContextMenu()}
      </>
    );
  }

  function renderExposedComponents() {
    if (!data.exposedComponents) {
      return null;
    }

    // Group exposed components by their providing plugin
    const exposedComponentGroups = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!exposedComponentGroups.has(comp.providingPlugin)) {
        exposedComponentGroups.set(comp.providingPlugin, []);
      }
      exposedComponentGroups.get(comp.providingPlugin)!.push(comp.id);
    });

    const componentBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH; // Use same width as other views
    const componentBoxHeight = 60; // Two-line boxes (title + ID)

    return (
      <g>
        {Array.from(exposedComponentGroups.entries()).map(([providingPlugin, componentIds], groupIndex) => {
          const firstCompPos = exposedComponentPositions.get(componentIds[0]);
          if (!firstCompPos) {
            return null;
          }

          const groupHeight = firstCompPos.groupHeight;

          return (
            <g key={providingPlugin}>
              {/* Provider group box */}
              <rect
                x={firstCompPos.x - 20}
                y={firstCompPos.groupY}
                width={componentBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                onClick={(event) => handleContentProviderLeftClick(event, providingPlugin)}
                onContextMenu={(event) => handleContentProviderContextMenu(event, providingPlugin)}
                style={{ cursor: 'pointer' }}
                pointerEvents="all"
              />

              {/* Exposed components inside provider box */}
              {componentIds.map((compId) => {
                const compPos = exposedComponentPositions.get(compId);
                if (!compPos) {
                  return null;
                }

                const exposedComponent = data.exposedComponents?.find((comp) => comp.id === compId);
                if (!exposedComponent) {
                  return null;
                }

                return (
                  <g key={compId}>
                    {/* Individual exposed component box */}
                    <rect
                      x={compPos.x}
                      y={compPos.y - componentBoxHeight / 2}
                      width={componentBoxWidth}
                      height={componentBoxHeight}
                      fill={theme.colors.warning.main}
                      stroke={
                        selectedExposedComponent === exposedComponent.id
                          ? theme.colors.primary.border
                          : theme.colors.border.strong
                      }
                      strokeWidth={
                        selectedExposedComponent === exposedComponent.id
                          ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                          : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
                      }
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                      onClick={() =>
                        onExposedComponentClick(
                          selectedExposedComponent === exposedComponent.id ? null : exposedComponent.id
                        )
                      }
                      style={{ cursor: 'pointer' }}
                    />

                    {/* Component title */}
                    <text
                      x={compPos.x + componentBoxWidth / 2}
                      y={compPos.y - 5}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                    >
                      {exposedComponent.title || exposedComponent.id}
                    </text>

                    {/* Component ID - second line */}
                    <text
                      x={compPos.x + componentBoxWidth / 2}
                      y={compPos.y + 15}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(theme.colors.warning.main)}
                      style={{ fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`, pointerEvents: 'none' }}
                    >
                      {exposedComponent.id}
                    </text>
                  </g>
                );
              })}

              {/* Provider plugin name header */}
              <text
                x={firstCompPos.x}
                y={firstCompPos.groupY + 25}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                fontWeight="bold"
              >
                {getDisplayName(providingPlugin)}
              </text>

              {/* App version */}
              {(() => {
                const appNode = data.nodes.find((node) => node.id === providingPlugin);
                if (appNode?.version) {
                  return (
                    <text
                      x={firstCompPos.x + componentBoxWidth}
                      y={firstCompPos.groupY + 25}
                      textAnchor="end"
                      fill={theme.colors.text.secondary}
                      fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                    >
                      <Trans i18nKey="dependency-graph.app-version">{polishVersion(appNode.version)}</Trans>
                    </text>
                  );
                }
                return null;
              })()}

              {/* Dotted line separator between provider sections (except for the last one) */}
              {groupIndex < Array.from(exposedComponentGroups.entries()).length - 1 && (
                <line
                  x1={10}
                  y1={firstCompPos.groupY + groupHeight + (getResponsiveGroupSpacing(height) + 30) / 2}
                  x2={width - 10}
                  y2={firstCompPos.groupY + groupHeight + (getResponsiveGroupSpacing(height) + 30) / 2}
                  stroke={theme.colors.border.medium}
                  strokeWidth={1}
                  strokeDasharray="5,5"
                />
              )}
            </g>
          );
        })}
      </g>
    );
  }

  function renderContentConsumers() {
    if (!data.exposedComponents) {
      return null;
    }

    // Get all unique consumers from exposed components
    const allConsumersSet = new Set<string>();
    data.exposedComponents.forEach((comp) => {
      comp.consumers.forEach((consumerId) => {
        allConsumersSet.add(consumerId);
      });
    });

    if (allConsumersSet.size === 0) {
      return null;
    }

    const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;

    // Group consumers by provider section to keep them within their respective sections
    const consumerGroupsByProvider = new Map<string, string[]>();
    data.exposedComponents.forEach((comp) => {
      if (!consumerGroupsByProvider.has(comp.providingPlugin)) {
        consumerGroupsByProvider.set(comp.providingPlugin, []);
      }
      comp.consumers.forEach((consumerId) => {
        if (!consumerGroupsByProvider.get(comp.providingPlugin)!.includes(consumerId)) {
          consumerGroupsByProvider.get(comp.providingPlugin)!.push(consumerId);
        }
      });
    });

    return (
      <g>
        {Array.from(consumerGroupsByProvider.entries()).map(([providingPlugin, consumerIds]) => {
          // Get the first exposed component position for this provider to align consumer group
          const firstCompPos = exposedComponentPositions.get(
            data.exposedComponents?.find((comp) => comp.providingPlugin === providingPlugin)?.id || ''
          );

          if (!firstCompPos || consumerIds.length === 0) {
            return null;
          }

          // Position consumer boxes within this provider's section
          const consumerBoxHeight = 50; // Just enough height for the header
          const consumerSpacing = 60; // Space between consumer boxes
          const rightMargin = getRightMargin(width);
          const consumerBoxX = width - rightMargin - consumerBoxWidth - 20;

          return (
            <g key={`consumers-${providingPlugin}`}>
              {consumerIds.map((consumerId, index) => {
                const consumerNode = data.nodes.find((node) => node.id === consumerId);
                const consumerY = firstCompPos.groupY + 25 + index * consumerSpacing; // Position within the provider's section

                return (
                  <g key={consumerId}>
                    {/* Individual consumer box */}
                    <rect
                      x={consumerBoxX - 20}
                      y={consumerY}
                      width={consumerBoxWidth + 40}
                      height={consumerBoxHeight}
                      fill={theme.colors.background.secondary}
                      stroke={theme.colors.border.strong}
                      strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                      rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                      onClick={(event) => handleContentConsumerLeftClick(event, consumerId)}
                      onContextMenu={(event) => handleContentConsumerContextMenu(event, consumerId)}
                      style={{ cursor: 'pointer' }}
                      pointerEvents="all"
                    />

                    {/* Consumer app name as header */}
                    <text
                      x={consumerBoxX}
                      y={consumerY + 25}
                      textAnchor="start"
                      fill={theme.colors.text.primary}
                      fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                      fontWeight="bold"
                    >
                      {getDisplayName(consumerId)}
                    </text>

                    {/* Consumer version */}
                    {consumerNode?.version && (
                      <text
                        x={consumerBoxX + consumerBoxWidth}
                        y={consumerY + 25}
                        textAnchor="end"
                        fill={theme.colors.text.secondary}
                        fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                      >
                        <Trans i18nKey="dependency-graph.app-version">{polishVersion(consumerNode.version)}</Trans>
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPointMode() {
    if (!data.extensions || !data.extensionPoints) {
      return null;
    }

    return (
      <g>
        {/* Render extensions on the left side */}
        {renderExtensions()}

        {/* Render extension points on the right side */}
        {renderExtensionPointsForMode()}
      </g>
    );
  }

  function renderExtensions() {
    if (!data.extensions) {
      return null;
    }

    // Group extensions by their providing plugin (app)
    const extensionGroups = new Map<string, string[]>();
    data.extensions.forEach((ext) => {
      if (!extensionGroups.has(ext.providingPlugin)) {
        extensionGroups.set(ext.providingPlugin, []);
      }
      extensionGroups.get(ext.providingPlugin)!.push(ext.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60; // Two-line boxes (title + ID)

    return (
      <g>
        {Array.from(extensionGroups.entries()).map(([providingPlugin, extensionIds]) => {
          const firstExtPos = extensionPositions.get(extensionIds[0]);
          if (!firstExtPos) {
            return null;
          }

          const groupHeight = firstExtPos.groupHeight;

          return (
            <g key={providingPlugin}>
              {/* App section box */}
              <rect
                x={firstExtPos.x - 20}
                y={firstExtPos.groupY}
                width={extensionBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                onClick={(event) => handleContentProviderLeftClick(event, providingPlugin)}
                onContextMenu={(event) => handleContentProviderContextMenu(event, providingPlugin)}
                style={{ cursor: 'pointer' }}
                pointerEvents="all"
              />

              {/* Extensions inside app section */}
              {extensionIds.map((extId) => {
                const extPos = extensionPositions.get(extId);
                if (!extPos) {
                  return null;
                }

                const extension = data.extensions?.find((ext) => ext.id === extId);
                if (!extension) {
                  return null;
                }

                const extensionColor = getExtensionColor(extension.type);

                return (
                  <g key={extId}>
                    {/* Individual extension box */}
                    <rect
                      x={extPos.x}
                      y={extPos.y - extensionBoxHeight / 2}
                      width={extensionBoxWidth}
                      height={extensionBoxHeight}
                      fill={extensionColor}
                      stroke={theme.colors.border.strong}
                      strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                      rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                      style={{ pointerEvents: 'none' }}
                    />

                    {/* Extension title */}
                    <text
                      x={extPos.x + extensionBoxWidth / 2}
                      y={extPos.y - 5}
                      textAnchor="middle"
                      fill={theme.colors.getContrastText(extensionColor)}
                      style={{ pointerEvents: 'none' }}
                    >
                      {extension.title || extension.id}
                    </text>

                    {/* Extension description */}
                    {extension.description && extension.description.trim() !== '' && (
                      <text
                        x={extPos.x + extensionBoxWidth / 2}
                        y={extPos.y + 15}
                        textAnchor="middle"
                        fill={theme.colors.getContrastText(extensionColor)}
                        style={{ fontSize: `${TYPOGRAPHY_CONSTANTS.DESCRIPTION_SIZE}px`, pointerEvents: 'none' }}
                      >
                        {extension.description}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* App name header */}
              <text
                x={firstExtPos.x}
                y={firstExtPos.groupY + 25}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {getDisplayName(providingPlugin)}
              </text>

              {/* App version */}
              {(() => {
                const appNode = data.nodes.find((node) => node.id === providingPlugin);
                if (appNode?.version) {
                  return (
                    <text
                      x={firstExtPos.x + extensionBoxWidth}
                      y={firstExtPos.groupY + 25}
                      textAnchor="end"
                      fill={theme.colors.text.secondary}
                      fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                      style={{ pointerEvents: 'none' }}
                    >
                      <Trans i18nKey="dependency-graph.app-version">{polishVersion(appNode.version)}</Trans>
                    </text>
                  );
                }
                return null;
              })()}
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPointsForMode() {
    if (!data.extensionPoints) {
      return null;
    }

    // Group extension points by their defining plugin, then by type
    const extensionPointGroups = new Map<string, Map<string, string[]>>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      const extensionType = ep.extensionType || 'link';
      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60; // Two-line boxes (title + ID)

    return (
      <g>
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, typeGroups]) => {
          // Get the first extension point to get group positioning info
          const firstTypeGroup = Array.from(typeGroups.values())[0];
          const firstEpPos = firstTypeGroup ? extensionPointModePositions.get(firstTypeGroup[0]) : null;
          if (!firstEpPos) {
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          return (
            <g key={definingPlugin}>
              {/* Defining plugin group box */}
              <rect
                x={firstEpPos.x - 20}
                y={firstEpPos.groupY}
                width={extensionBoxWidth + 40}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={theme.colors.border.strong}
                strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                onClick={(event) => handleContentConsumerLeftClick(event, definingPlugin)}
                onContextMenu={(event) => handleContentConsumerContextMenu(event, definingPlugin)}
                style={{ cursor: 'pointer' }}
                pointerEvents="all"
              />

              {/* Render extension points by type (no headers in extension point mode) */}
              {['function', 'component', 'link'].map((type) => {
                const extensionPointIds = typeGroups.get(type);
                if (!extensionPointIds || extensionPointIds.length === 0) {
                  return null;
                }

                return (
                  <g key={`${definingPlugin}-${type}`}>
                    {/* Extension points for this type */}
                    {extensionPointIds.map((epId) => {
                      const epPos = extensionPointModePositions.get(epId);
                      if (!epPos) {
                        return null;
                      }

                      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
                      if (!extensionPoint) {
                        return null;
                      }

                      const extensionCount = getExtensionCountForExtensionPoint(epId);

                      return (
                        <g key={epId}>
                          {/* Extension point box */}
                          <rect
                            x={epPos.x}
                            y={epPos.y - extensionBoxHeight / 2}
                            width={extensionBoxWidth}
                            height={extensionBoxHeight}
                            fill={theme.colors.primary.main}
                            stroke={theme.colors.border.strong}
                            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                            rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                            onClick={(event) => handleExtensionPointLeftClick(event, epId)}
                            onContextMenu={(event) => handleExtensionPointContextMenu(event, epId)}
                            style={{ cursor: 'pointer' }}
                            pointerEvents="all"
                          />

                          {/* Extension count badge */}
                          {extensionCount > 0 && (
                            <g>
                              {/* Badge background circle */}
                              <circle
                                cx={epPos.x + extensionBoxWidth - 12}
                                cy={epPos.y - extensionBoxHeight / 2 + 12}
                                r={8}
                                fill="#ffd700"
                              />
                              {/* Badge text */}
                              <text
                                x={epPos.x + extensionBoxWidth - 12}
                                y={epPos.y - extensionBoxHeight / 2 + 12}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#000000"
                                fontSize="10"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none' }}
                              >
                                {extensionCount}
                              </text>
                            </g>
                          )}

                          {/* Extension point ID */}
                          <text
                            x={epPos.x + extensionBoxWidth / 2}
                            y={epPos.y}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={theme.colors.getContrastText(theme.colors.primary.main)}
                            style={{
                              fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`,
                              pointerEvents: 'none',
                            }}
                          >
                            <tspan>{epId}</tspan>
                          </text>
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Defining plugin name header */}
              <text
                x={firstEpPos.x}
                y={firstEpPos.groupY + 25}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {getDisplayName(definingPlugin)}
              </text>

              {/* App version */}
              {(() => {
                const appNode = data.nodes.find((node) => node.id === definingPlugin);
                if (appNode?.version) {
                  return (
                    <text
                      x={firstEpPos.x + extensionBoxWidth}
                      y={firstEpPos.groupY + 25}
                      textAnchor="end"
                      fill={theme.colors.text.secondary}
                      fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                      style={{ pointerEvents: 'none' }}
                    >
                      <Trans i18nKey="dependency-graph.app-version">{polishVersion(appNode.version)}</Trans>
                    </text>
                  );
                }
                return null;
              })()}
            </g>
          );
        })}
      </g>
    );
  }

  function renderExtensionPoints() {
    if (!data.extensionPoints) {
      return null;
    }

    // Group extension points by their defining plugin, then by type
    const extensionPointGroups = new Map<string, Map<string, string[]>>();
    data.extensionPoints.forEach((ep) => {
      if (!extensionPointGroups.has(ep.definingPlugin)) {
        extensionPointGroups.set(ep.definingPlugin, new Map());
      }
      const pluginGroup = extensionPointGroups.get(ep.definingPlugin)!;
      const extensionType = ep.extensionType || 'link';
      if (!pluginGroup.has(extensionType)) {
        pluginGroup.set(extensionType, []);
      }
      pluginGroup.get(extensionType)!.push(ep.id);
    });

    const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
    const extensionBoxHeight = 60; // Two-line boxes (ID + description)

    return (
      <g>
        {Array.from(extensionPointGroups.entries()).map(([definingPlugin, typeGroups]) => {
          // Get the first extension point to get group positioning info
          const firstTypeGroup = Array.from(typeGroups.values())[0];
          const firstEpPos = firstTypeGroup ? extensionPointPositions.get(firstTypeGroup[0]) : null;
          if (!firstEpPos) {
            console.warn(`No first EP position found for plugin ${definingPlugin}`);
            return null;
          }

          const groupHeight = firstEpPos.groupHeight;

          return (
            <g key={definingPlugin}>
              {/* Defining plugin group box */}
              <rect
                x={firstEpPos.x - 10}
                y={firstEpPos.groupY}
                width={extensionBoxWidth + 20}
                height={groupHeight}
                fill={theme.colors.background.secondary}
                stroke={
                  selectedContentConsumer === definingPlugin ? theme.colors.primary.border : theme.colors.border.strong
                }
                strokeWidth={
                  selectedContentConsumer === definingPlugin
                    ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH
                    : VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                }
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                onClick={(event) => handleContentConsumerLeftClick(event, definingPlugin)}
                onContextMenu={(event) => handleContentConsumerContextMenu(event, definingPlugin)}
                style={{ cursor: 'pointer' }}
                pointerEvents="all"
              />

              {/* Render extension points by type with headers */}
              {['function', 'component', 'link'].map((type) => {
                const extensionPointIds = typeGroups.get(type);
                if (!extensionPointIds || extensionPointIds.length === 0) {
                  return null;
                }

                const firstEpInType = extensionPointPositions.get(extensionPointIds[0]);

                if (!firstEpInType) {
                  console.warn(
                    `No position found for first extension point of type ${type} in plugin ${definingPlugin}`
                  );
                  return null;
                }

                // Ensure we have valid positioning data
                if (typeof firstEpInType.y !== 'number' || isNaN(firstEpInType.y)) {
                  console.warn(
                    `Invalid Y position for extension point ${extensionPointIds[0]} in plugin ${definingPlugin}`
                  );
                  return null;
                }

                // Calculate header position using the stored typeHeaderY
                const headerY = firstEpInType.typeHeaderY || firstEpInType.y - 40;
                const headerX = firstEpPos.x + extensionBoxWidth / 2;

                // Ensure header position is valid
                if (isNaN(headerY) || isNaN(headerX)) {
                  console.warn(
                    `Invalid header position for type ${type} in plugin ${definingPlugin}: x=${headerX}, y=${headerY}`
                  );
                  return null;
                }

                return (
                  <g key={`${definingPlugin}-${type}`}>
                    {/* Type header - hide in addedlinks, addedcomponents, and addedfunctions modes since all extensions are of the same type */}
                    {options.visualizationMode !== 'addedlinks' &&
                      options.visualizationMode !== 'addedcomponents' &&
                      options.visualizationMode !== 'addedfunctions' && (
                        <text
                          x={firstEpPos.x}
                          y={headerY}
                          textAnchor="start"
                          fill={theme.colors.text.primary}
                          fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                          fontWeight="normal"
                          style={{
                            pointerEvents: 'none',
                            zIndex: 1000,
                          }}
                        >
                          {type === 'function' ? (
                            <Trans i18nKey="extensions.dependency-graph.function-extensions">Function extensions</Trans>
                          ) : type === 'component' ? (
                            <Trans i18nKey="extensions.dependency-graph.component-extensions">
                              Component extensions
                            </Trans>
                          ) : (
                            <Trans i18nKey="extensions.dependency-graph.link-extensions">Link extensions</Trans>
                          )}
                        </text>
                      )}

                    {/* Extension points for this type */}
                    {extensionPointIds.map((epId) => {
                      const epPos = extensionPointPositions.get(epId);
                      if (!epPos) {
                        return null;
                      }

                      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === epId);
                      const extensionType = extensionPoint?.extensionType || 'link';
                      const extensionColor = getExtensionColor(extensionType);

                      const extensionCount = getExtensionCountForExtensionPoint(epId);

                      return (
                        <g key={epId}>
                          {/* Extension point box with type-specific color */}
                          <rect
                            x={epPos.x}
                            y={epPos.y - extensionBoxHeight / 2}
                            width={extensionBoxWidth}
                            height={extensionBoxHeight}
                            fill={extensionColor}
                            stroke={theme.colors.border.strong}
                            strokeWidth={VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH}
                            rx={VISUAL_CONSTANTS.EXTENSION_BORDER_RADIUS}
                            onClick={(event) => handleLeftClick(event, epId)}
                            onContextMenu={(event) => handleContextMenu(event, epId)}
                            style={{ cursor: 'pointer' }}
                            pointerEvents="all"
                          />

                          {/* Extension count badge */}
                          {extensionCount > 0 && (
                            <g>
                              {/* Badge background circle */}
                              <circle
                                cx={epPos.x + extensionBoxWidth - 12}
                                cy={epPos.y - extensionBoxHeight / 2 + 12}
                                r={8}
                                fill="#ffd700"
                              />
                              {/* Badge text */}
                              <text
                                x={epPos.x + extensionBoxWidth - 12}
                                y={epPos.y - extensionBoxHeight / 2 + 12}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fill="#000000"
                                fontSize="10"
                                fontWeight="bold"
                                style={{ pointerEvents: 'none' }}
                              >
                                {extensionCount}
                              </text>
                            </g>
                          )}

                          {/* Extension point ID - first line */}
                          {(() => {
                            const hasDescription =
                              extensionPoint?.description && extensionPoint.description.trim() !== '';
                            const epIdY = hasDescription
                              ? options.showDependencyTypes
                                ? epPos.y - 5
                                : epPos.y + 5
                              : epPos.y;

                            return (
                              <text
                                x={epPos.x + extensionBoxWidth / 2}
                                y={epIdY}
                                textAnchor="middle"
                                dominantBaseline={hasDescription ? undefined : 'middle'}
                                fill={theme.colors.getContrastText(extensionColor)}
                                style={{
                                  fontSize: `${TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}px`,
                                  pointerEvents: 'none',
                                }}
                              >
                                {epId}
                              </text>
                            );
                          })()}

                          {/* Extension point description - second line */}
                          {extensionPoint?.description && extensionPoint.description.trim() !== '' && (
                            <text
                              x={epPos.x + extensionBoxWidth / 2}
                              y={options.showDependencyTypes ? epPos.y + 10 : epPos.y + 20}
                              textAnchor="middle"
                              fill={theme.colors.getContrastText(extensionColor)}
                              style={{ fontSize: `${TYPOGRAPHY_CONSTANTS.DESCRIPTION_SIZE}px`, pointerEvents: 'none' }}
                            >
                              {extensionPoint.description}
                            </text>
                          )}

                          {/* Extension type - third line in parentheses */}
                          {options.showDependencyTypes && (
                            <g>
                              <text
                                x={epPos.x + extensionBoxWidth / 2}
                                y={epPos.y + 30}
                                textAnchor="middle"
                                fill={theme.colors.getContrastText(extensionColor)}
                                style={{ pointerEvents: 'none' }}
                              >
                                {/* ({extensionType} extension) */}
                              </text>

                              {/* Description text underneath parentheses */}
                              {options.showDescriptions &&
                                extensionPoint?.description &&
                                extensionPoint.description.trim() !== '' && (
                                  <text
                                    x={epPos.x + extensionBoxWidth / 2}
                                    y={epPos.y + 45}
                                    textAnchor="middle"
                                    fill={theme.colors.getContrastText(extensionColor)}
                                    style={{ pointerEvents: 'none' }}
                                  >
                                    {extensionPoint.description}
                                  </text>
                                )}
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Defining plugin name header */}
              <text
                x={firstEpPos.x}
                y={firstEpPos.groupY + 22}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {getDisplayName(definingPlugin)}
              </text>

              {/* App version */}
              {(() => {
                const appNode = data.nodes.find((node) => node.id === definingPlugin);
                if (appNode?.version) {
                  return (
                    <text
                      x={firstEpPos.x + extensionBoxWidth}
                      y={firstEpPos.groupY + 22}
                      textAnchor="end"
                      fill={theme.colors.text.secondary}
                      fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                      style={{ pointerEvents: 'none' }}
                    >
                      <Trans i18nKey="dependency-graph.app-version">{polishVersion(appNode.version)}</Trans>
                    </text>
                  );
                }
                return null;
              })()}
            </g>
          );
        })}
      </g>
    );
  }

  function getExtensionColor(type: string): string {
    switch (type) {
      case 'component':
        return options.componentExtensionColor || COLOR_DEFAULTS.COMPONENT_EXTENSION;
      case 'function':
        return options.functionExtensionColor || COLOR_DEFAULTS.FUNCTION_EXTENSION;
      case 'link':
      default:
        return options.linkExtensionColor || COLOR_DEFAULTS.LINK_EXTENSION;
    }
  }

  function getDisplayName(pluginId: string): string {
    if (pluginId === 'grafana-core') {
      return DISPLAY_NAMES.GRAFANA_CORE;
    }
    return pluginId;
  }
};
