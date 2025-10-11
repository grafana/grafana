/**
 * Add Dependency Link Renderer
 *
 * Renders dependency links for add mode (addedlinks, addedcomponents, addedfunctions).
 */

import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS } from '../../constants';
import { GraphData } from '../../types';
import { NodeWithPosition, PositionInfo } from '../GraphLayout';

interface AddDependencyLinkRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  nodes: NodeWithPosition[];
  extensionPointPositions: Map<string, PositionInfo>;
  selectedContentProvider: string | null;
  selectedContentConsumer: string | null;
  highlightedExtensionPointId: string | null;
  styles: {
    link: { toString(): string };
    linkHighlighted: { toString(): string };
  };
}

/**
 * Renders dependency links for add mode
 */
export function AddDependencyLinkRenderer({
  theme,
  data,
  nodes,
  extensionPointPositions,
  selectedContentProvider,
  selectedContentConsumer,
  highlightedExtensionPointId,
  styles,
}: AddDependencyLinkRendererProps): React.JSX.Element {
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

  return <>{arrows}</>;
}
