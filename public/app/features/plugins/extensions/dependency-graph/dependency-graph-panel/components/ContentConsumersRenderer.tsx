import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import {
  LAYOUT_CONSTANTS,
  TYPOGRAPHY_CONSTANTS,
  VISUAL_CONSTANTS,
  getResponsiveGroupSpacing,
  getRightMargin,
} from '../constants';
import { GraphData, PanelOptions } from '../types';
import { getDisplayName } from '../utils/helpers/extensionUtils';

import { PositionInfo } from './GraphLayout';

interface ContentConsumersRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  options: PanelOptions;
  width: number;
  height: number;
  selectedContentConsumer: string | null;
  onContentConsumerClick: (id: string | null) => void;
  onContentConsumerContextMenu: (event: React.MouseEvent, consumerId: string) => void;
  styles: {
    contentConsumerBox: { toString(): string };
    contentConsumerLabel: { toString(): string };
  };
}

/**
 * Component for rendering content consumers in expose mode
 */
export function ContentConsumersRenderer({
  theme,
  data,
  options,
  width,
  height,
  selectedContentConsumer,
  onContentConsumerClick,
  onContentConsumerContextMenu,
  styles,
}: ContentConsumersRendererProps): JSX.Element {
  const rightMargin = getRightMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Calculate consumer positions
  const consumerPositions: Map<string, PositionInfo> = new Map();

  // Get all unique consumers from exposed components
  const allConsumersSet = new Set<string>();
  data.exposedComponents?.forEach((comp) => {
    comp.consumers.forEach((consumerId) => {
      allConsumersSet.add(consumerId);
    });
  });

  const consumers = Array.from(allConsumersSet);

  consumers.forEach((consumerId, index) => {
    const x = width - rightMargin - LAYOUT_CONSTANTS.MIN_NODE_WIDTH;
    const y = LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + 10);

    consumerPositions.set(consumerId, { x, y, groupY: y, groupHeight: LAYOUT_CONSTANTS.MIN_NODE_HEIGHT });
  });

  return (
    <>
      {Array.from(consumerPositions.entries()).map(([consumerId, position]) => {
        const consumer = data.nodes?.find((node) => node.id === consumerId);
        if (!consumer) {
          return null;
        }

        const isSelected = selectedContentConsumer === consumerId;
        const strokeColor = isSelected ? theme.colors.primary.border : theme.colors.border.medium;
        const strokeWidth = isSelected ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH;

        return (
          <g key={consumerId}>
            {/* Content Consumer Box */}
            <rect
              x={position.x}
              y={position.y}
              width={LAYOUT_CONSTANTS.MIN_NODE_WIDTH}
              height={LAYOUT_CONSTANTS.MIN_NODE_HEIGHT}
              rx={VISUAL_CONSTANTS.NODE_BORDER_RADIUS}
              fill={theme.colors.background.secondary}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              className={styles.contentConsumerBox.toString()}
              onClick={() => onContentConsumerClick(consumerId)}
              onContextMenu={(e) => onContentConsumerContextMenu(e, consumerId)}
              style={{ cursor: 'pointer' }}
            />

            {/* Content Consumer Label */}
            <text
              x={position.x + 10}
              y={position.y + 20}
              fontSize={TYPOGRAPHY_CONSTANTS.PLUGIN_LABEL_SIZE}
              fill={theme.colors.text.primary}
              className={styles.contentConsumerLabel.toString()}
            >
              {getDisplayName(consumer.id)}
            </text>
          </g>
        );
      })}
    </>
  );
}
