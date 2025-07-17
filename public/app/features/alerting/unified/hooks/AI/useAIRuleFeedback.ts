import { useCallback, useState } from 'react';

import { useURLSearchParams } from '../useURLSearchParams';

export interface UseAIRuleFeedbackReturn {
  isFromAI: boolean;
  feedbackGiven: boolean;
  handleAIFeedback: (helpful: boolean, comment?: string) => void;
}

export interface AIFeedbackTracker {
  (props: { helpful: boolean; comment?: string; [key: string]: unknown }): void;
}

/**
 * Hook to handle AI-generated feedback functionality
 * Detects if the current route was reached from AI generation
 * and provides feedback handling capabilities
 *
 * @param trackFeedback Function to track the feedback (analytics)
 * @param featureEnabled Whether the AI feature is enabled for this context
 */
export function useAIRuleFeedback(trackFeedback: AIFeedbackTracker, featureEnabled: boolean): UseAIRuleFeedbackReturn {
  const [searchParams] = useURLSearchParams();

  // Only show feedback when the route was reached from AI AND the feature is enabled
  const isFromAI = featureEnabled && searchParams.get('fromAI') === 'true';

  const [feedbackGiven, setFeedbackGiven] = useState(false);

  // Handle AI feedback submission
  const handleAIFeedback = useCallback(
    (helpful: boolean, comment?: string) => {
      trackFeedback({
        helpful,
        comment,
      });

      setFeedbackGiven(true);
    },
    [trackFeedback]
  );

  return {
    isFromAI,
    feedbackGiven,
    handleAIFeedback,
  };
}
