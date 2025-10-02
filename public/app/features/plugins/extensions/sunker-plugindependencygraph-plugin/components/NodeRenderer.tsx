/**
 * Node Renderer Component
 *
 * Renders plugin nodes (boxes) in the dependency graph.
 */

import { VISUAL_CONSTANTS, getResponsiveNodeHeight, getResponsiveNodeWidth } from '../constants';

import { GrafanaTheme2 } from '@grafana/data';
import { GraphData } from '../types';
import { NodeWithPosition } from './GraphLayout';
import React from 'react';

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
    node: string;
    nodeBox: string;
    appIdLabel: string;
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
    // In expose mode, only render consumer nodes (providers are now rendered as group boxes in ExtensionRenderer)
    const contentProviders = new Set<string>();
    const contentConsumers = new Set<string>();

    if (data.exposedComponents) {
      data.exposedComponents.forEach((comp) => {
        contentProviders.add(comp.providingPlugin);
        comp.consumers.forEach((consumerId) => {
          contentConsumers.add(consumerId);
        });
      });
    }

    // Render section-specific consumer instances (nodes with originalId set) and exclude provider nodes
    nodesToRender = nodes.filter((node) => node.originalId || (!contentProviders.has(node.id) && !node.originalId));
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
      {nodesToRender.map((node) => (
        <g
          key={node.id}
          transform={`translate(${node.x - nodeWidth / 2}, ${node.y - nodeHeight / 2})`}
          className={styles.node}
        >
          {/* Main app box */}
          <rect
            width={nodeWidth}
            height={nodeHeight}
            fill={theme.colors.primary.main}
            stroke={
              (isExposeMode && selectedContentConsumer === (node.originalId || node.id)) ||
              (!isExposeMode && selectedContentProvider === node.id)
                ? theme.colors.primary.border
                : theme.colors.border.strong
            }
            strokeWidth={
              (isExposeMode && selectedContentConsumer === (node.originalId || node.id)) ||
              (!isExposeMode && selectedContentProvider === node.id)
                ? VISUAL_CONSTANTS.THICK_STROKE_WIDTH
                : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
            }
            rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
            className={styles.nodeBox}
            onClick={() => {
              if (isExposeMode) {
                onContentConsumerClick(
                  selectedContentConsumer === (node.originalId || node.id) ? null : node.originalId || node.id
                );
              } else {
                onContentProviderClick(selectedContentProvider === node.id ? null : node.id);
              }
            }}
            style={{ cursor: 'pointer' }}
          />

          {/* App ID label */}
          <text
            x={nodeWidth / 2}
            y={nodeHeight / 2}
            textAnchor="middle"
            className={styles.appIdLabel}
            fill={theme.colors.getContrastText(theme.colors.primary.main)}
          >
            {node.originalId || node.id}
          </text>
        </g>
      ))}
    </g>
  );
};
