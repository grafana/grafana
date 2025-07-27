import { useState, useRef } from 'react';

export const useSQLSuggestions = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const prevSuggestionsLengthRef = useRef(0);

  /**
   * Handle new suggestions from the AI system
   * Updates the suggestions list and manages unseen suggestions state
   */
  const handleHistoryUpdate = (history: string[]) => {
    setSuggestions(history);

    // Auto-open drawer when new suggestions are received during feedback loop
    if (history.length > prevSuggestionsLengthRef.current) {
      setIsDrawerOpen(true);
    }

    // Update the reference to track suggestion count for next time
    prevSuggestionsLengthRef.current = history.length;
  };

  /**
   * Handle applying a suggestion to the editor
   * Returns the suggestion for the parent component to handle
   * i.e., the parent component can then use the suggestions for the editor drawer
   */
  const handleApplySuggestion = (suggestion: string) => {
    setIsDrawerOpen(false);
    return suggestion;
  };

  const handleOpenDrawer = () => setIsDrawerOpen(true);
  const handleCloseDrawer = () => setIsDrawerOpen(false);

  const clearSuggestions = () => {
    setSuggestions([]);
    setIsDrawerOpen(false);
    prevSuggestionsLengthRef.current = 0;
  };

  return {
    // state
    suggestions,
    isDrawerOpen,

    // actions
    handleHistoryUpdate,
    handleApplySuggestion,
    handleOpenDrawer,
    handleCloseDrawer,
    clearSuggestions,
  };
};
