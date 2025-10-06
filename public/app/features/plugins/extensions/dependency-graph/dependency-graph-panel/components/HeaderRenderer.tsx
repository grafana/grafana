/**
 * Header Renderer Component
 *
 * Renders section headers and divider lines for the dependency graph.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import {
  LAYOUT_CONSTANTS,
  MODE_LABELS,
  getResponsiveMargin,
  getResponsiveNodeWidth,
  getRightMargin,
} from '../constants';

interface HeaderRendererProps {
  theme: GrafanaTheme2;
  width: number;
  isExposeMode: boolean;
  isExtensionPointMode: boolean;
  styles: {
    sectionHeader: SerializedStyles;
  };
}

export const HeaderRenderer: React.FC<HeaderRendererProps> = ({
  theme,
  width,
  isExposeMode,
  isExtensionPointMode,
  styles,
}) => {
  const margin = getResponsiveMargin(width);
  const nodeWidth = getResponsiveNodeWidth(width);

  if (isExposeMode) {
    return (
      <g>
        {/* Main mode heading - centered "Expose APIs" */}
        <text
          x={width / 2}
          y={LAYOUT_CONSTANTS.HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.EXPOSE_MODE}
        </text>

        {/* Content Provider Header (left in expose mode) */}
        <text
          x={margin + nodeWidth / 2}
          y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.CONTENT_PROVIDER}
        </text>

        {/* Content Consumer Header (right in expose mode) */}
        <text
          x={width - getRightMargin(width) - nodeWidth / 2}
          y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.CONTENT_CONSUMER}
        </text>

        {/* Horizontal dotted line across entire graph underneath headlines */}
        <line
          x1={margin}
          y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          x2={width - getRightMargin(width)}
          y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />
      </g>
    );
  }

  if (isExtensionPointMode) {
    return (
      <g>
        {/* Main mode heading - centered "Extension Point Usage" */}
        <text
          x={width / 2}
          y={LAYOUT_CONSTANTS.HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.EXTENSION_POINT_MODE}
        </text>

        {/* Extensions Header (left in extension point mode) */}
        <text
          x={margin + 220} // Position over extension boxes on the left
          y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.EXTENSIONS}
        </text>

        {/* Extension Points Header (right in extension point mode) */}
        <text
          x={width - margin - 210} // Position over extension point boxes on the right
          y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
          textAnchor="middle"
          fill={theme.colors.text.primary}
          style={{ fontSize: '18px', fontWeight: 'bold' }}
        >
          {MODE_LABELS.EXTENSION_POINTS}
        </text>

        {/* Horizontal dotted line across entire graph underneath headlines */}
        <line
          x1={margin}
          y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          x2={width - margin}
          y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />
      </g>
    );
  }

  return (
    <g>
      {/* Main mode heading - centered "Add APIs" */}
      <text
        x={width / 2}
        y={LAYOUT_CONSTANTS.HEADER_Y_OFFSET}
        textAnchor="middle"
        fill={theme.colors.text.primary}
        style={{ fontSize: '18px', fontWeight: 'bold' }}
      >
        {MODE_LABELS.ADD_MODE}
      </text>

      {/* Content Provider Header */}
      <text
        x={margin + 113} // Centered over boxes at new position
        y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
        textAnchor="middle"
        fill={theme.colors.text.primary}
        style={{ fontSize: '18px', fontWeight: 'bold' }}
      >
        {MODE_LABELS.CONTENT_PROVIDER}
      </text>

      {/* Content Consumer Header */}
      <text
        x={width - margin - 210} // Center over the wider boxes (400/2 + 10 for arrow safety margin)
        y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
        textAnchor="middle"
        fill={theme.colors.text.primary}
        style={{ fontSize: '18px', fontWeight: 'bold' }}
      >
        {MODE_LABELS.CONTENT_CONSUMER}
      </text>

      {/* Horizontal dotted line across entire graph underneath headlines */}
      <line
        x1={margin}
        y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        x2={width - margin}
        y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        stroke={theme.colors.border.medium}
        strokeWidth={1}
        strokeDasharray="5,5"
      />
    </g>
  );
};
