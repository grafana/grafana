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
  styles: {
    link: SerializedStyles;
    linkHighlighted: SerializedStyles;
  };
}

export const LinkRenderer: React.FC<LinkRendererProps> = ({
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
  styles,
}) => {
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
        const endX = firstExtensionPos.x - 2; // End at left edge of extension box so arrowhead shows
        const endY = groupCenterY;

        // Calculate control points for a curved path
        const midX = (startX + endX) / 2;
        const controlX1 = startX + (midX - startX) * 0.6;
        const controlX2 = endX - (endX - midX) * 0.6;

        const pathData = `M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`;

        // Check if this arrow should be highlighted
        const isHighlighted = selectedContentProvider === sourceId;

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
                selectedContentProvider && !isHighlighted
                  ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                  : VISUAL_CONSTANTS.SELECTED_OPACITY
              }
            />
          </g>
        );

        arrowIndex++;
      });
    });

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
        const isConsumerArrowHighlighted =
          selectedExposedComponent === exposedComponent.id || selectedContentConsumer === consumerId;

        // Calculate consumer box position (right side of the graph) - use same logic as ExtensionRenderer
        const rightMargin = getRightMargin(width);
        const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
        const consumerBoxX = width - rightMargin - consumerBoxWidth - 20; // Left edge of consumer box
        const consumerBoxHeight = 50; // Height of consumer box
        const consumerSpacing = 60; // Space between consumer boxes

        // Find the index of this consumer within the specific provider's section
        const providerConsumers = exposedComponent.consumers;
        const consumerIndex = providerConsumers.indexOf(consumerId);

        // Use the same positioning logic as ExtensionRenderer - position within the provider's section
        // We need to get the provider's group position, not the individual component position
        const providerId = exposedComponent.providingPlugin;
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
              (selectedExposedComponent || selectedContentConsumer) && !isConsumerArrowHighlighted
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

      arrows.push(
        <g key={`${extension.id}-${extension.targetExtensionPoint}`}>
          <path
            d={pathData}
            fill="none"
            stroke={theme.colors.primary.main}
            strokeWidth={VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH}
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    });

    return <g>{arrows}</g>;
  }
};
