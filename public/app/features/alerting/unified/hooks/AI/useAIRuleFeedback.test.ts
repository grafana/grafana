import { act, renderHook } from '@testing-library/react';

import { config } from '@grafana/runtime';

import { testWithFeatureToggles } from '../../test/test-utils';

import { useAIRuleFeedback } from './useAIRuleFeedback';

const mockUseURLSearchParams = jest.fn();
jest.mock('../useURLSearchParams', () => ({
  useURLSearchParams: () => mockUseURLSearchParams(),
}));

describe('useAIRuleFeedback', () => {
  const mockTracker = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with feature toggle enabled', () => {
    testWithFeatureToggles(['alertingAIGenAlertRules']);

    it('should return isFromAI as true when fromAI param is true', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=true'),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      expect(result.current.isFromAI).toBe(true);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should return isFromAI as false when fromAI param is not present', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams(''),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should return isFromAI as false when fromAI param is false', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=false'),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should handle feedback submission correctly', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=true'),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      // Initial state
      expect(result.current.feedbackGiven).toBe(false);

      // Submit feedback
      act(() => {
        result.current.handleAIFeedback(true, 'Great feature!');
      });

      // Check feedback was tracked
      expect(mockTracker).toHaveBeenCalledWith({
        helpful: true,
        comment: 'Great feature!',
      });

      // Check state was updated
      expect(result.current.feedbackGiven).toBe(true);
    });

    it('should handle feedback submission without comment', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=true'),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      act(() => {
        result.current.handleAIFeedback(false);
      });

      expect(mockTracker).toHaveBeenCalledWith({
        helpful: false,
        comment: undefined,
      });

      expect(result.current.feedbackGiven).toBe(true);
    });

    it('should maintain feedbackGiven state between renders', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=true'),
        jest.fn(),
      ]);

      const { result, rerender } = renderHook(() => useAIRuleFeedback(mockTracker, config.featureToggles.alertingAIGenAlertRules === true));

      // Submit feedback
      act(() => {
        result.current.handleAIFeedback(true);
      });

      expect(result.current.feedbackGiven).toBe(true);

      // Rerender and check state is maintained
      rerender();
      expect(result.current.feedbackGiven).toBe(true);
    });
  });

  describe('with feature toggle disabled', () => {
    testWithFeatureToggles([]);

    it('should return isFromAI as false when fromAI param is true but feature is disabled', () => {
      mockUseURLSearchParams.mockReturnValue([
        new URLSearchParams('fromAI=true'),
        jest.fn(),
      ]);

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, false));

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });
  });
}); 
