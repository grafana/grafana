/**
 * Extension Point Mode Link Renderer
 *
 * Renders dependency links for extension point mode.
 */

import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS } from '../../constants';
import { GraphData } from '../../types';
import { PositionInfo } from '../GraphLayout';

interface ExtensionPointModeLinkRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  extensionPositions: Map<string, PositionInfo>;
  extensionPointModePositions: Map<string, PositionInfo>;
  selectedContentConsumer: string | null;
  selectedContentProvider: string | null;
  styles: {
    link: { toString(): string };
    linkHighlighted: { toString(): string };
  };
}

/**
 * Renders dependency links for extension point mode
 */
export function ExtensionPointModeLinkRenderer({
  theme,
  data,
  extensionPositions,
  extensionPointModePositions,
  selectedContentConsumer,
  selectedContentProvider,
  styles,
}: ExtensionPointModeLinkRendererProps): React.JSX.Element {
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
            isArrowHighlighted ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
          }
          markerEnd={isArrowHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
          opacity={
            (selectedContentConsumer || selectedContentProvider) && !isArrowHighlighted
              ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
              : VISUAL_CONSTANTS.SELECTED_OPACITY
          }
        />
      </g>
    );
  });

  return <g>{arrows}</g>;
}
