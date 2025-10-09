import { useState } from 'react';

import { NodeWithPosition } from '../components/GraphLayout';

/**
 * Custom hook for managing dependency graph state
 *
 * This hook encapsulates all the state management logic for the dependency graph,
 * including selections, highlights, and node positions.
 */
export function useDependencyGraphState() {
  // Node state
  const [nodes, setNodes] = useState<NodeWithPosition[]>([]);

  // Selection state
  const [selectedExposedComponent, setSelectedExposedComponent] = useState<string | null>(null);
  const [selectedContentConsumer, setSelectedContentConsumer] = useState<string | null>(null);
  const [selectedContentProvider, setSelectedContentProvider] = useState<string | null>(null);

  // Highlight state
  const [highlightedExtensionPointId, setHighlightedExtensionPointId] = useState<string | null>(null);

  return {
    // State
    nodes,
    selectedExposedComponent,
    selectedContentConsumer,
    selectedContentProvider,
    highlightedExtensionPointId,

    // Setters
    setNodes,
    setSelectedExposedComponent,
    setSelectedContentConsumer,
    setSelectedContentProvider,
    setHighlightedExtensionPointId,
  };
}
