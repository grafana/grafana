/**
 * Link Renderer Component
 *
 * Renders dependency links/arrows between nodes in the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS, getResponsiveComponentWidth, getResponsiveNodeWidth } from '../constants';
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

        const nodeWidth = getResponsiveNodeWidth(width);
        const startX = sourceNode.x + nodeWidth / 2;
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
    const nodeWidth = getResponsiveNodeWidth(width);
    const componentBoxWidth = getResponsiveComponentWidth(width);

    data.exposedComponents.forEach((exposedComponent) => {
      const componentPos = exposedComponentPositions.get(exposedComponent.id);
      if (!componentPos) {
        return;
      }

      // Arrows: Section-specific consumers → Component (within same provider section only)
      exposedComponent.consumers.forEach((consumerId) => {
        // Find the section-specific consumer instance for this provider
        const sectionConsumerNode = nodes.find(
          (n) => n.originalId === consumerId && n.id.includes(`-at-${exposedComponent.providingPlugin}`)
        );

        if (sectionConsumerNode) {
          // Check if this specific arrow should be highlighted
          const isThisArrowHighlighted =
            selectedExposedComponent === exposedComponent.id || selectedContentConsumer === consumerId;

          // Simple straight line within the same section - adjust end position so arrowhead is visible
          const startX = sectionConsumerNode.x - nodeWidth / 2;
          const startY = sectionConsumerNode.y;
          const endX = componentPos.x + componentBoxWidth - 2; // End at right edge of component box so arrowhead shows
          const endY = componentPos.y;

          arrows.push(
            <line
              key={`consumer-to-component-${exposedComponent.id}-${sectionConsumerNode.id}`}
              x1={startX}
              y1={startY}
              x2={endX}
              y2={endY}
              stroke={isThisArrowHighlighted ? theme.colors.success.main : theme.colors.primary.main}
              strokeWidth={
                isThisArrowHighlighted ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
              }
              markerEnd={isThisArrowHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
              opacity={
                (selectedExposedComponent || selectedContentConsumer) && !isThisArrowHighlighted
                  ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
                  : VISUAL_CONSTANTS.SELECTED_OPACITY
              }
            />
          );
        }
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
