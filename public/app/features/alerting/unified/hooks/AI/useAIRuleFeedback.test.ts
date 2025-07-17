import { act, renderHook } from '@testing-library/react';
import { getWrapper } from 'test/test-utils';

import { useAIRuleFeedback } from './useAIRuleFeedback';

describe('useAIRuleFeedback', () => {
  const mockTracker = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with feature toggle enabled', () => {
    it('should return isFromAI as true when fromAI param is true', () => {
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=true'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

      expect(result.current.isFromAI).toBe(true);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should return isFromAI as false when fromAI param is not present', () => {
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should return isFromAI as false when fromAI param is false', () => {
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=false'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });

    it('should handle feedback submission correctly', () => {
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=true'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

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
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=true'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

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
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=true'],
        },
      });

      const { result, rerender } = renderHook(() => useAIRuleFeedback(mockTracker, true), { wrapper });

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
    it('should return isFromAI as false when fromAI param is true but feature is disabled', () => {
      const wrapper = getWrapper({
        renderWithRouter: true,
        historyOptions: {
          initialEntries: ['/alerting/rule/new?fromAI=true'],
        },
      });

      const { result } = renderHook(() => useAIRuleFeedback(mockTracker, false), { wrapper });

      expect(result.current.isFromAI).toBe(false);
      expect(result.current.feedbackGiven).toBe(false);
    });
  });
});
