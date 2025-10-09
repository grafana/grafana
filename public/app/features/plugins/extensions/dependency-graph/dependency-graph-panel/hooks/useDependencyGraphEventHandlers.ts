import { useCallback } from 'react';

interface UseDependencyGraphEventHandlersProps {
  selectedExposedComponent: string | null;
  selectedContentConsumer: string | null;
  selectedContentProvider: string | null;
  highlightedExtensionPointId: string | null;
  setSelectedExposedComponent: (id: string | null) => void;
  setSelectedContentConsumer: (id: string | null) => void;
  setSelectedContentProvider: (id: string | null) => void;
  setHighlightedExtensionPointId: (id: string | null) => void;
}

/**
 * Custom hook for managing dependency graph event handlers
 *
 * This hook encapsulates all the event handling logic for the dependency graph,
 * including click handlers and selection management.
 */
export function useDependencyGraphEventHandlers({
  selectedExposedComponent,
  selectedContentConsumer,
  selectedContentProvider,
  highlightedExtensionPointId,
  setSelectedExposedComponent,
  setSelectedContentConsumer,
  setSelectedContentProvider,
  setHighlightedExtensionPointId,
}: UseDependencyGraphEventHandlersProps) {
  const handleExposedComponentClick = useCallback(
    (id: string | null) => {
      setSelectedExposedComponent(selectedExposedComponent === id ? null : id);
      // Clear consumer selection when selecting an exposed component
      if (id !== null && selectedContentConsumer !== null) {
        setSelectedContentConsumer(null);
      }
    },
    [selectedExposedComponent, selectedContentConsumer, setSelectedExposedComponent, setSelectedContentConsumer]
  );

  const handleContentConsumerClick = useCallback(
    (id: string | null) => {
      setSelectedContentConsumer(selectedContentConsumer === id ? null : id);
      // Clear exposed component selection when selecting a consumer
      if (id !== null && selectedExposedComponent !== null) {
        setSelectedExposedComponent(null);
      }
    },
    [selectedContentConsumer, selectedExposedComponent, setSelectedContentConsumer, setSelectedExposedComponent]
  );

  const handleContentProviderClick = useCallback(
    (id: string | null) => {
      setSelectedContentProvider(selectedContentProvider === id ? null : id);
    },
    [selectedContentProvider, setSelectedContentProvider]
  );

  const handleHighlightedExtensionPointChange = useCallback(
    (id: string | null) => {
      setHighlightedExtensionPointId(id);
    },
    [setHighlightedExtensionPointId]
  );

  const handleSvgClick = useCallback(
    (event: React.MouseEvent) => {
      // Clear highlighted extension point, selected content consumer, and selected content provider when clicking on the SVG background
      if (highlightedExtensionPointId) {
        setHighlightedExtensionPointId(null);
      }
      if (selectedContentConsumer) {
        setSelectedContentConsumer(null);
      }
      if (selectedContentProvider) {
        setSelectedContentProvider(null);
      }
    },
    [
      highlightedExtensionPointId,
      selectedContentConsumer,
      selectedContentProvider,
      setHighlightedExtensionPointId,
      setSelectedContentConsumer,
      setSelectedContentProvider,
    ]
  );

  return {
    handleExposedComponentClick,
    handleContentConsumerClick,
    handleContentProviderClick,
    handleHighlightedExtensionPointChange,
    handleSvgClick,
  };
}
