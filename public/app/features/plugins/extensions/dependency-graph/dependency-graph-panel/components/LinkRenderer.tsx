/**
 * Link Renderer Component
 *
 * Renders dependency links/arrows between nodes in the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS, getRightMargin } from '../constants';
import { GraphData } from '../types';

import { NodeWithPosition, PositionInfo } from './GraphLayout';

interface LinkRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  nodes: NodeWithPosition[];
  extensionPointPositions: Map<string, PositionInfo>;
  exposedComponentPositions: Map<string, PositionInfo>;
  extensionPositions: Map<string, PositionInfo>;
  extensionPointModePositions: Map<string, PositionInfo>;
  width: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
  selectedExposedComponent: string | null;
  selectedContentConsumer: string | null;
  selectedContentProvider: string | null;
  highlightedExtensionPointId: string | null;
  styles: {
    link: SerializedStyles;
    linkHighlighted: SerializedStyles;
  };
}

export function LinkRenderer({
  theme,
  data,
  nodes,
  extensionPointPositions,
  exposedComponentPositions,
  extensionPositions,
  extensionPointModePositions,
  width,
  isExposeMode,
  isExtensionPointMode,
  selectedExposedComponent,
  selectedContentConsumer,
  selectedContentProvider,
  highlightedExtensionPointId,
  styles,
}: LinkRendererProps) {
  if (isExposeMode) {
    return renderExposeDependencyLinks();
  }

  if (isExtensionPointMode) {
    return renderExtensionPointModeLinks();
  }

  return renderAddDependencyLinks();

  function renderAddDependencyLinks() {
    // Group dependencies by source and defining plugin to consolidate arrows
    const groupedDeps = new Map<string, Map<string, string[]>>();

    data.dependencies.forEach((dep) => {
      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === dep.target);
      if (!extensionPoint) {
        return;
      }

      const sourceId = dep.source;
      const definingPlugin = extensionPoint.definingPlugin;

      if (!groupedDeps.has(sourceId)) {
        groupedDeps.set(sourceId, new Map());
      }
      if (!groupedDeps.get(sourceId)!.has(definingPlugin)) {
        groupedDeps.get(sourceId)!.set(definingPlugin, []);
      }
      groupedDeps.get(sourceId)!.get(definingPlugin)!.push(dep.target);
    });

    const arrows: React.JSX.Element[] = [];
    let arrowIndex = 0;

    groupedDeps.forEach((definingPluginMap, sourceId) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) {
        return;
      }

      definingPluginMap.forEach((extensionPointIds, definingPlugin) => {
        // Find the center position of this defining plugin group
        const firstExtensionId = extensionPointIds[0];
        const firstExtensionPos = extensionPointPositions.get(firstExtensionId);
        if (!firstExtensionPos) {
          return;
        }

        // Calculate group center
        const groupCenterY = firstExtensionPos.groupY + firstExtensionPos.groupHeight / 2;

        // For consumer-style content provider boxes, calculate start position from right edge
        const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
        const startX = sourceNode.x + consumerBoxWidth / 2; // Right edge of consumer-style box
        const startY = sourceNode.y;

        // End just next to the left edge of the outer consumer box, not the inner extension point box
        // The outer consumer box left edge is at firstExtensionPos.x - 10
        const endX = firstExtensionPos.x - 10 - 4; // 5 pixels to the left of the left edge of outer consumer box
        const endY = groupCenterY;

        // Calculate control points for a curved path
        const midX = (startX + endX) / 2;
        const controlX1 = startX + (midX - startX) * 0.6;
        const controlX2 = endX - (endX - midX) * 0.6;

        const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

        // Check if this arrow should be highlighted
        // Highlight if: 1) source is selected content provider, OR 2) target (definingPlugin) is selected content consumer
        // Note: We don't highlight existing arrows for extension points - we'll draw new ones instead
        const isHighlighted = selectedContentProvider === sourceId || selectedContentConsumer === definingPlugin;

        arrows.push(
          <g key={`${sourceId}-${definingPlugin}-${arrowIndex}`}>
            {/* Connection path */}
            <path
              d={pathData}
              fill="none"
              stroke={isHighlighted ? theme.colors.success.main : theme.colors.primary.main}
              strokeWidth={isHighlighted ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH : VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
              markerEnd={isHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
              opacity={
                (selectedContentProvider || selectedContentConsumer || highlightedExtensionPointId) && !isHighlighted
                  ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                  : VISUAL_CONSTANTS.SELECTED_OPACITY
              }
            />
          </g>
        );

        arrowIndex++;
      });
    });

    // Add new arrows that point directly to the highlighted extension point
    if (highlightedExtensionPointId) {
      const highlightedExtensionPoint = data.extensionPoints?.find((ep) => ep.id === highlightedExtensionPointId);
      if (highlightedExtensionPoint) {
        const extensionPointPos = extensionPointPositions.get(highlightedExtensionPointId);
        if (extensionPointPos) {
          // Find all content providers that extend this extension point
          const contentProviders =
            data.dependencies?.filter((dep) => dep.target === highlightedExtensionPointId).map((dep) => dep.source) ||
            [];

          contentProviders.forEach((providerId) => {
            const providerNode = nodes.find((n) => n.id === providerId);
            if (providerNode) {
              // Calculate positions for the new arrow
              const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
              const startX = providerNode.x + consumerBoxWidth / 2; // Right edge of provider box
              const startY = providerNode.y;

              // Point directly to the extension point box
              const endX = extensionPointPos.x;
              const endY = extensionPointPos.y;

              // Calculate control points for a curved path
              const midX = (startX + endX) / 2;
              const controlX1 = startX + (midX - startX) * 0.6;
              const controlX2 = endX - (endX - midX) * 0.6;

              const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

              arrows.push(
                <g key={`highlighted-${providerId}-${highlightedExtensionPointId}-${arrowIndex}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={theme.colors.success.main}
                    strokeWidth={VISUAL_CONSTANTS.THICK_STROKE_WIDTH}
                    markerEnd="url(#arrowhead-highlighted)"
                    opacity={VISUAL_CONSTANTS.SELECTED_OPACITY}
                  />
                </g>
              );
              arrowIndex++;
            }
          });
        }
      }
    }

    return <g>{arrows}</g>;
  }

  function renderExposeDependencyLinks() {
    if (!data.exposedComponents) {
      return <g></g>;
    }

    const arrows: React.JSX.Element[] = [];
    const componentBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH; // Use same width as other views

    data.exposedComponents.forEach((exposedComponent) => {
      const componentPos = exposedComponentPositions.get(exposedComponent.id);
      if (!componentPos) {
        return;
      }

      // Arrows: Consumer → Component (pointing to the right side of the component box)
      exposedComponent.consumers.forEach((consumerId) => {
        // Check if this specific arrow should be highlighted
        // Only highlight if:
        // 1. The specific component is selected
        // 2. The specific consumer (right side) is selected
        // 3. The selected content provider (left side) is the providing plugin AND this component belongs to that provider
        const isConsumerArrowHighlighted =
          selectedExposedComponent === exposedComponent.id ||
          selectedContentConsumer === consumerId ||
          selectedContentProvider === exposedComponent.providingPlugin;

        // Calculate consumer box position (right side of the graph) - use same logic as ExtensionRenderer
        const rightMargin = getRightMargin(width);
        const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
        const consumerBoxX = width - rightMargin - consumerBoxWidth - 20; // Left edge of consumer box
        const consumerBoxHeight = 50; // Height of consumer box
        const consumerSpacing = 60; // Space between consumer boxes

        // Use the same positioning logic as ExtensionRenderer - position within the provider's section
        // We need to get the provider's group position, not the individual component position
        const providerId = exposedComponent.providingPlugin;

        // Find the index of this consumer within the specific provider's section
        // We need to get all consumers for this provider, not just for this specific component
        const providerConsumers = new Set<string>();
        data.exposedComponents?.forEach((comp) => {
          if (comp.providingPlugin === providerId) {
            comp.consumers.forEach((consumerId) => {
              providerConsumers.add(consumerId);
            });
          }
        });
        const providerConsumersArray = Array.from(providerConsumers);
        const consumerIndex = providerConsumersArray.indexOf(consumerId);

        const firstExposedComponent = data.exposedComponents?.find((comp) => comp.providingPlugin === providerId);
        if (!firstExposedComponent) {
          return; // Skip this consumer if we can't find the provider
        }

        const firstCompPos = exposedComponentPositions.get(firstExposedComponent.id);
        if (!firstCompPos) {
          return; // Skip this consumer if we can't find its position
        }

        const consumerBoxY = firstCompPos.groupY + 25 + consumerIndex * consumerSpacing;

        // Arrow starts from the middle of the left side of the consumer box
        // The actual left edge of the consumer box is at consumerBoxX - 20 (same as ExtensionRenderer)
        const consumerStartX = consumerBoxX - 20; // Left edge of consumer box
        const consumerStartY = consumerBoxY + consumerBoxHeight / 2; // Middle of consumer box

        // Arrow from consumer to component - pointing to the right side of the component box
        const componentEndX = componentPos.x + componentBoxWidth + 5; // End at right edge of component box
        const componentEndY = componentPos.y;

        arrows.push(
          <line
            key={`consumer-to-component-${exposedComponent.id}-${consumerId}`}
            x1={consumerStartX}
            y1={consumerStartY}
            x2={componentEndX}
            y2={componentEndY}
            stroke={isConsumerArrowHighlighted ? theme.colors.success.main : theme.colors.primary.main}
            strokeWidth={
              isConsumerArrowHighlighted
                ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
            }
            markerEnd={isConsumerArrowHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
            opacity={
              (selectedExposedComponent || selectedContentConsumer || selectedContentProvider) &&
              !isConsumerArrowHighlighted
                ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                : VISUAL_CONSTANTS.SELECTED_OPACITY
            }
          />
        );
      });
    });

    return <g>{arrows}</g>;
  }

  function renderExtensionPointModeLinks() {
    if (!data.extensions || !data.extensionPoints) {
      return <g></g>;
    }

    const arrows: React.ReactElement[] = [];

    // Create one arrow per extension (not per app)
    data.extensions.forEach((extension) => {
      // Get the extension position
      const extPos = extensionPositions.get(extension.id);
      if (!extPos) {
        return;
      }

      // Get the extension point position
      const epPos = extensionPointModePositions.get(extension.targetExtensionPoint);
      if (!epPos) {
        return;
      }

      const extensionBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
      const startX = extPos.x + extensionBoxWidth + 20; // Start from the right edge of the extension box
      const startY = extPos.y; // Center vertically on the extension box
      const endX = epPos.x - 2; // End at left edge of extension point box
      const endY = epPos.y;

      // Calculate control points for a curved path
      const midX = (startX + endX) / 2;
      const controlX1 = startX + (midX - startX) * 0.6;
      const controlX2 = endX - (endX - midX) * 0.6;

      const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

      // Check if this arrow should be highlighted
      const extensionPoint = data.extensionPoints?.find((ep) => ep.id === extension.targetExtensionPoint);
      const isArrowHighlighted =
        selectedContentConsumer === extension.providingPlugin ||
        selectedContentConsumer === extensionPoint?.definingPlugin ||
        selectedContentProvider === extension.providingPlugin;

      arrows.push(
        <g key={`${extension.id}-${extension.targetExtensionPoint}`}>
          <path
            d={pathData}
            fill="none"
            stroke={isArrowHighlighted ? theme.colors.success.main : theme.colors.primary.main}
            strokeWidth={
              isArrowHighlighted ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH : VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
            }
            markerEnd={isArrowHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
            opacity={
              selectedContentConsumer && !isArrowHighlighted
                ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                : VISUAL_CONSTANTS.SELECTED_OPACITY
            }
          />
        </g>
      );
    });

    return <g>{arrows}</g>;
  }
}
