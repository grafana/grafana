/**
 * Expose Dependency Link Renderer
 *
 * Renders dependency links for expose mode (exposedComponents).
 */

import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { LAYOUT_CONSTANTS, VISUAL_CONSTANTS, getRightMargin } from '../../constants';
import { GraphData } from '../../types';
import { PositionInfo } from '../GraphLayout';

interface ExposeDependencyLinkRendererProps {
  theme: GrafanaTheme2;
  data: GraphData;
  width: number;
  exposedComponentPositions: Map<string, PositionInfo>;
  selectedExposedComponent: string | null;
  selectedContentConsumer: string | null;
  selectedContentProvider: string | null;
  styles: {
    link: { toString(): string };
    linkHighlighted: { toString(): string };
  };
}

/**
 * Renders dependency links for expose mode
 */
export function ExposeDependencyLinkRenderer({
  theme,
  data,
  width,
  exposedComponentPositions,
  selectedExposedComponent,
  selectedContentConsumer,
  selectedContentProvider,
  styles,
}: ExposeDependencyLinkRendererProps): React.JSX.Element {
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
      // Only highlight if:
      // 1. The specific component is selected
      // 2. The specific consumer (right side) is selected
      // 3. The selected content provider (left side) is the providing plugin AND this component belongs to that provider
      const isConsumerArrowHighlighted =
        selectedExposedComponent === exposedComponent.id ||
        selectedContentConsumer === consumerId ||
        selectedContentProvider === exposedComponent.providingPlugin;

      // Calculate consumer box position (right side of the graph) - use same logic as ExtensionRenderer
      const rightMargin = getRightMargin(width);
      const consumerBoxWidth = LAYOUT_CONSTANTS.EXTENSION_BOX_WIDTH;
      const consumerBoxX = width - rightMargin - consumerBoxWidth - 20; // Left edge of consumer box
      const consumerBoxHeight = 50; // Height of consumer box
      const consumerSpacing = 60; // Space between consumer boxes

      // Use the same positioning logic as ExtensionRenderer - position within the provider's section
      // We need to get the provider's group position, not the individual component position
      const providerId = exposedComponent.providingPlugin;

      // Find the index of this consumer within the specific provider's section
      // We need to get all consumers for this provider, not just for this specific component
      const providerConsumers = new Set<string>();
      data.exposedComponents?.forEach((comp) => {
        if (comp.providingPlugin === providerId) {
          comp.consumers.forEach((consumerId) => {
            providerConsumers.add(consumerId);
          });
        }
      });

      const providerConsumersArray = Array.from(providerConsumers);
      const consumerIndex = providerConsumersArray.indexOf(consumerId);

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
            isConsumerArrowHighlighted ? VISUAL_CONSTANTS.SELECTED_STROKE_WIDTH : VISUAL_CONSTANTS.DEFAULT_STROKE_WIDTH
          }
          markerEnd={isConsumerArrowHighlighted ? 'url(#arrowhead-highlighted)' : 'url(#arrowhead)'}
          opacity={
            (selectedExposedComponent || selectedContentConsumer || selectedContentProvider) &&
            !isConsumerArrowHighlighted
              ? VISUAL_CONSTANTS.UNSELECTED_OPACITY
              : VISUAL_CONSTANTS.SELECTED_OPACITY
          }
        />
      );
    });
  });

  return <g>{arrows}</g>;
}
