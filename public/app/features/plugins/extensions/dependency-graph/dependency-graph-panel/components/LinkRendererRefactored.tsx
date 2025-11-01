/**
 * Link Renderer Component (Refactored)
 *
 * Main entry point for link rendering. This file now imports
 * from focused modules for better organization and maintainability.
 */

import { SerializedStyles } from '@emotion/react';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { GraphData } from '../types';

import { NodeWithPosition, PositionInfo } from './GraphLayout';
import { AddDependencyLinkRenderer } from './linkRendering/AddDependencyLinkRenderer';
import { ExposeDependencyLinkRenderer } from './linkRendering/ExposeDependencyLinkRenderer';
import { ExtensionPointModeLinkRenderer } from './linkRendering/ExtensionPointModeLinkRenderer';

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
  highlightedExtensionPointId: string | null;
  styles: {
    link: SerializedStyles;
    linkHighlighted: SerializedStyles;
  };
}

export const LinkRendererRefactored: React.FC<LinkRendererProps> = ({
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
  highlightedExtensionPointId,
  styles,
}) => {
  if (isExposeMode) {
    return (
      <ExposeDependencyLinkRenderer
        theme={theme}
        data={data}
        width={width}
        exposedComponentPositions={exposedComponentPositions}
        selectedExposedComponent={selectedExposedComponent}
        selectedContentConsumer={selectedContentConsumer}
        selectedContentProvider={selectedContentProvider}
        styles={styles}
      />
    );
  }

  if (isExtensionPointMode) {
    return (
      <ExtensionPointModeLinkRenderer
        theme={theme}
        data={data}
        extensionPositions={extensionPositions}
        extensionPointModePositions={extensionPointModePositions}
        selectedContentConsumer={selectedContentConsumer}
        selectedContentProvider={selectedContentProvider}
        styles={styles}
      />
    );
  }

  return (
    <AddDependencyLinkRenderer
      theme={theme}
      data={data}
      nodes={nodes}
      extensionPointPositions={extensionPointPositions}
      selectedContentProvider={selectedContentProvider}
      selectedContentConsumer={selectedContentConsumer}
      highlightedExtensionPointId={highlightedExtensionPointId}
      styles={styles}
    />
  );
};
