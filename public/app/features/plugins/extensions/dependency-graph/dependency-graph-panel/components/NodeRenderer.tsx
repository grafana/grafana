/**
 * Node Renderer Component
 *
 * Renders plugin nodes (boxes) in the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';
import semver from 'semver';

import { GrafanaTheme2 } from '@grafana/data';

import {
  DISPLAY_NAMES,
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveNodeHeight,
  getResponsiveNodeWidth,
} from '../constants';
import { GraphData } from '../types';

import { NodeWithPosition } from './GraphLayout';

interface NodeRendererProps {
  theme: GrafanaTheme2;
  nodes: NodeWithPosition[];
  data: GraphData;
  width: number;
  height: number;
  isExposeMode: boolean;
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

export const NodeRenderer: React.FC<NodeRendererProps> = ({
  theme,
  nodes,
  data,
  width,
  height,
  isExposeMode,
  selectedContentConsumer,
  selectedContentProvider,
  onContentConsumerClick,
  onContentProviderClick,
  styles,
}) => {
  let nodesToRender: NodeWithPosition[];

  if (isExposeMode) {
    // In expose mode, don't render any nodes - both providers and consumers are now rendered as group boxes in ExtensionRenderer
    nodesToRender = [];
  } else {
    // In add mode, render only content provider apps on the left
    const contentProviders = new Set<string>();
    data.dependencies.forEach((dep) => {
      if (data.extensionPoints?.some((ep) => ep.id === dep.target)) {
        // Check if target is an actual extension point
        contentProviders.add(dep.source);
      }
    });
    nodesToRender = nodes.filter((node) => contentProviders.has(node.id));
  }

  const nodeWidth = getResponsiveNodeWidth(width);
  const nodeHeight = getResponsiveNodeHeight(height);

  return (
    <g>
      {nodesToRender.map((node) => {
        // For non-expose mode (Added links view), render consumer-style boxes
        if (!isExposeMode) {
          const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
          const consumerBoxHeight = 50;

          // Position the box so it fits within the panel boundaries
          const boxX = node.x - consumerBoxWidth / 2;

          return (
            <g key={node.id}>
              {/* Consumer-style box */}
              <rect
                x={boxX}
                y={node.y - consumerBoxHeight / 2}
                width={consumerBoxWidth}
                height={consumerBoxHeight}
                fill={theme.colors.background.secondary}
                stroke={selectedContentProvider === node.id ? theme.colors.primary.border : theme.colors.border.strong}
                strokeWidth={
                  selectedContentProvider === node.id
                    ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH
                    : VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH
                }
                rx={VISUAL_CONSTANTS.GROUP_BORDER_RADIUS}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();

                  // Immediately clear any existing highlighting/selections
                  onContentConsumerClick(null);

                  onContentProviderClick(selectedContentProvider === node.id ? null : node.id);
                }}
                style={{ cursor: 'pointer' }}
                pointerEvents="all"
              />

              {/* App name as header */}
              <text
                x={boxX + 10}
                y={node.y + 5}
                textAnchor="start"
                fill={theme.colors.text.primary}
                fontSize={TYPOGRAPHY_CONSTANTS.SECTION_HEADER_SIZE}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {getDisplayName(node.id)}
              </text>

              {/* App version */}
              {node.version && (
                <text
                  x={boxX + consumerBoxWidth - 10}
                  y={node.y + 5}
                  textAnchor="end"
                  fill={theme.colors.text.primary}
                  fontSize={TYPOGRAPHY_CONSTANTS.EXTENSION_LABEL_SIZE}
                  style={{ pointerEvents: 'none' }}
                >
                  {polishVersion(node.version)}
                </text>
              )}
            </g>
          );
        }

        // For expose mode, render the original blue boxes (though this shouldn't be called in expose mode)
        return (
          <g key={node.id} transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}>
            {/* Main app box */}
            <rect
              width={nodeWidth}
              height={nodeHeight}
              fill={theme.colors.primary.main}
              stroke={
                selectedContentConsumer === (node.originalId || node.id)
                  ? theme.colors.primary.border
                  : theme.colors.border.strong
              }
              strokeWidth={
                selectedContentConsumer === (node.originalId || node.id)
                  ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH
                  : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
              }
              rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
              onClick={() => {
                onContentConsumerClick(
                  selectedContentConsumer === (node.originalId || node.id) ? null : node.originalId || node.id
                );
              }}
              style={{ cursor: 'pointer' }}
            />

            {/* App ID label */}
            <text
              x={nodeWidth / 2}
              y={nodeHeight / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={theme.colors.getContrastText(theme.colors.primary.main)}
            >
              {node.originalId || node.id}
            </text>
          </g>
        );
      })}
    </g>
  );
};

// Helper function to get display name for an app
function getDisplayName(appId: string): string {
  if (appId === 'grafana-core') {
    return DISPLAY_NAMES.GRAFANA_CORE;
  }
  if (appId === 'grafana-core-display') {
    return DISPLAY_NAMES.GRAFANA_CORE_DISPLAY;
  }
  return appId;
}

// Helper function to polish version strings
function polishVersion(version: string): string {
  try {
    const parsed = semver.parse(version);
    if (parsed) {
      return `v${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }
  } catch (error) {
    console.warn('Failed to parse version:', version, error);
  }
  return version;
}
