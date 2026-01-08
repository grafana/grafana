import { useState, useMemo } from 'react';

export const useSQLExplanations = (currentExpression: string) => {
  const [explanation, setExplanation] = useState<string>('');
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);
  const [prevExpression, setPrevExpression] = useState<string>(currentExpression);

  /**
   * Handle new explanation from the AI system
   * Sets the explanation and opens the modal
   */
  const handleExplain = (newExplanation: string) => {
    setExplanation(newExplanation);
    setIsExplanationOpen(true);
  };

  const handleOpenExplanation = () => setIsExplanationOpen(true);

  const handleCloseExplanation = () => setIsExplanationOpen(false);

  /**
   * Update the previous expression tracker
   * Should be called when the query expression changes
   */
  const updatePrevExpression = (newExpression: string) => {
    setPrevExpression(newExpression);
    // Clear explanation when expression changes
    setExplanation('');
  };

  const clearExplanation = () => {
    setExplanation('');
    setIsExplanationOpen(false);
  };

  /**
   * Determine if we should show "View explanation" button vs "Explain query" button
   * Returns true if there's an existing explanation OR if the expression has changed
   */
  const shouldShowViewExplanation = useMemo(() => {
    return Boolean(explanation) || prevExpression !== currentExpression;
  }, [explanation, prevExpression, currentExpression]);

  return {
    // State
    explanation,
    isExplanationOpen,
    prevExpression,

    // Computed state
    shouldShowViewExplanation,

    // Actions
    handleExplain,
    handleOpenExplanation,
    handleCloseExplanation,
    updatePrevExpression,
    clearExplanation,
  };
};
