import { useState } from 'react';

export const useSQLSuggestions = () => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [hasUnseenSuggestions, setHasUnseenSuggestions] = useState(false);

  /**
   * Handle new suggestions from the AI system
   * Updates the suggestions list and manages unseen suggestions state
   */
  const handleHistoryUpdate = (history: string[]) => {
    setSuggestions(history);
    setHasUnseenSuggestions(true);

    // Auto-open drawer when first suggestion is generated
    if (history.length === 1) {
      setIsDrawerOpen(true);
      setHasUnseenSuggestions(false);
    }
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

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
    setHasUnseenSuggestions(false);
  };

  const handleCloseDrawer = () => setIsDrawerOpen(false);

  const clearSuggestions = () => {
    setSuggestions([]);
    setHasUnseenSuggestions(false);
    setIsDrawerOpen(false);
  };

  return {
    // state
    suggestions,
    isDrawerOpen,

    // computed state
    hasUnseenSuggestions,

    // actions
    handleHistoryUpdate,
    handleApplySuggestion,
    handleOpenDrawer,
    handleCloseDrawer,
    clearSuggestions,
  };
};
