/**
 * Header Renderer Component
 *
 * Renders section headers and divider lines for the dependency graph.
 */

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
  styles: {
    sectionHeader: string;
  };
}

export const HeaderRenderer: React.FC<HeaderRendererProps> = ({ theme, width, isExposeMode, styles }) => {
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
          className={styles.sectionHeader}
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
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          {MODE_LABELS.CONTENT_PROVIDER}
        </text>

        {/* Dashed line under Content Provider header */}
        <line
          x1={margin + 10}
          y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          x2={margin + nodeWidth - 10}
          y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          stroke={theme.colors.border.medium}
          strokeWidth={1}
          strokeDasharray="5,5"
        />

        {/* Content Consumer Header (right in expose mode) */}
        <text
          x={width - getRightMargin(width) - nodeWidth / 2}
          y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
          textAnchor="middle"
          className={styles.sectionHeader}
          fill={theme.colors.text.primary}
        >
          {MODE_LABELS.CONTENT_CONSUMER}
        </text>

        {/* Dashed line under Content Consumer header */}
        <line
          x1={width - getRightMargin(width) - nodeWidth + 10}
          y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
          x2={width - getRightMargin(width) - 10}
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
        className={styles.sectionHeader}
        fill={theme.colors.text.primary}
        style={{ fontSize: '18px', fontWeight: 'bold' }}
      >
        {MODE_LABELS.ADD_MODE}
      </text>

      {/* Content Provider Header */}
      <text
        x={margin + 90}
        y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
        textAnchor="middle"
        className={styles.sectionHeader}
        fill={theme.colors.text.primary}
      >
        {MODE_LABELS.CONTENT_PROVIDER}
      </text>

      {/* Dashed line under Content Provider header */}
      <line
        x1={margin + 90 - nodeWidth / 2} // Match left edge of provider box
        y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        x2={margin + 90 + nodeWidth / 2} // Match right edge of provider box
        y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        stroke={theme.colors.border.medium}
        strokeWidth={1}
        strokeDasharray="5,5"
      />

      {/* Content Consumer Header */}
      <text
        x={width - margin - 150} // Center over the actual box positions
        y={LAYOUT_CONSTANTS.SUB_HEADER_Y_OFFSET}
        textAnchor="middle"
        className={styles.sectionHeader}
        fill={theme.colors.text.primary}
      >
        {MODE_LABELS.CONTENT_CONSUMER}
      </text>

      {/* Dashed line under Content Consumer header */}
      <line
        x1={width - margin - 290 - 5} // Align with left edge of boxes with small buffer
        y1={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        x2={width - margin - LAYOUT_CONSTANTS.ARROW_SAFETY_MARGIN + 5} // Align with right edge of boxes with small buffer
        y2={LAYOUT_CONSTANTS.HEADER_LINE_Y_OFFSET}
        stroke={theme.colors.border.medium}
        strokeWidth={1}
        strokeDasharray="5,5"
      />
    </g>
  );
};
