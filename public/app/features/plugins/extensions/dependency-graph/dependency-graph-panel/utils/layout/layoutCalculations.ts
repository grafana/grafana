/**
 * Layout Calculation Functions
 *
 * Main layout calculation functions for different visualization modes.
 */

import {
  LAYOUT_CONSTANTS,
  getResponsiveGroupSpacing,
  getResponsiveNodeSpacing,
  getResponsiveNodeWidth,
  getRightMargin,
} from '../../constants';
import { GraphData, PanelOptions } from '../../types';

import { NodeWithPosition } from './layoutTypes';

/**
 * Calculate layout for expose mode
 */
export function calculateExposeLayout(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  margin: number
): NodeWithPosition[] {
  const nodeSpacing = getResponsiveNodeSpacing(height);
  const nodeWidth = getResponsiveNodeWidth(width);
  const rightMargin = getRightMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group nodes by content providers and consumers
  const contentProviders = new Set(options.selectedContentProviders || []);
  const contentConsumers = new Set(options.selectedContentConsumers || []);

  const providers = data.nodes.filter((node) => contentProviders.has(node.id));
  const consumers = data.nodes.filter((node) => contentConsumers.has(node.id));

  const result: NodeWithPosition[] = [];

  // Position providers on the left
  providers.forEach((node, index) => {
    result.push({
      ...node,
      x: margin,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  // Position consumers on the right
  consumers.forEach((node, index) => {
    result.push({
      ...node,
      x: width - rightMargin - nodeWidth,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  return result;
}

/**
 * Calculate layout for extension point mode
 */
export function calculateExtensionPointLayout(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  margin: number
): NodeWithPosition[] {
  const nodeSpacing = getResponsiveNodeSpacing(height);
  const nodeWidth = getResponsiveNodeWidth(width);
  const rightMargin = getRightMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group nodes by content providers and consumers
  const contentProviders = new Set(options.selectedContentProviders || []);
  const contentConsumers = new Set(options.selectedContentConsumers || []);

  const providers = data.nodes.filter((node) => contentProviders.has(node.id));
  const consumers = data.nodes.filter((node) => contentConsumers.has(node.id));

  const result: NodeWithPosition[] = [];

  // Position providers on the left
  providers.forEach((node, index) => {
    result.push({
      ...node,
      x: margin,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  // Position consumers on the right
  consumers.forEach((node, index) => {
    result.push({
      ...node,
      x: width - rightMargin - nodeWidth,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  return result;
}

/**
 * Calculate layout for add mode (addedlinks, addedcomponents, addedfunctions)
 */
export function calculateAddLayout(
  data: GraphData,
  options: PanelOptions,
  width: number,
  height: number,
  margin: number,
  nodeSpacing: number
): NodeWithPosition[] {
  const nodeWidth = getResponsiveNodeWidth(width);
  const rightMargin = getRightMargin(width);
  const groupSpacing = getResponsiveGroupSpacing(height);

  // Group nodes by content providers and consumers
  const contentProviders = new Set(options.selectedContentProviders || []);
  const contentConsumers = new Set(options.selectedContentConsumers || []);

  const providers = data.nodes.filter((node) => contentProviders.has(node.id));
  const consumers = data.nodes.filter((node) => contentConsumers.has(node.id));

  const result: NodeWithPosition[] = [];

  // Position providers on the left
  providers.forEach((node, index) => {
    result.push({
      ...node,
      x: margin,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  // Position consumers on the right
  consumers.forEach((node, index) => {
    result.push({
      ...node,
      x: width - rightMargin - nodeWidth,
      y: LAYOUT_CONSTANTS.HEADER_Y_OFFSET + groupSpacing + index * (LAYOUT_CONSTANTS.MIN_NODE_HEIGHT + nodeSpacing),
    });
  });

  return result;
}
