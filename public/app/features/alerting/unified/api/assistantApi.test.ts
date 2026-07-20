import {
  getAssistantInvestigationUrl,
  isAssistantInvestigationActive,
  isAssistantInvestigationCompleted,
  isAssistantInvestigationFailed,
  isAssistantInvestigationTerminal,
} from './assistantApi';

describe('assistantApi helpers', () => {
  describe('isAssistantInvestigationActive', () => {
    it.each(['pending', 'running', 'in_progress', 'in-progress', 'paused'])('treats %s as active', (state) => {
      expect(isAssistantInvestigationActive(state)).toBe(true);
    });

    it.each(['completed', 'failed', 'cancelled', 'canceled', undefined, ''])('treats %s as inactive', (state) => {
      expect(isAssistantInvestigationActive(state)).toBe(false);
    });
  });

  describe('isAssistantInvestigationCompleted', () => {
    it('is true only for completed', () => {
      expect(isAssistantInvestigationCompleted('completed')).toBe(true);
      expect(isAssistantInvestigationCompleted('in_progress')).toBe(false);
    });
  });

  describe('isAssistantInvestigationFailed', () => {
    it.each(['failed', 'cancelled', 'canceled'])('treats %s as failed', (state) => {
      expect(isAssistantInvestigationFailed(state)).toBe(true);
    });

    it('is false for other states', () => {
      expect(isAssistantInvestigationFailed('completed')).toBe(false);
      expect(isAssistantInvestigationFailed(undefined)).toBe(false);
    });
  });

  describe('isAssistantInvestigationTerminal', () => {
    it.each(['completed', 'failed', 'cancelled', 'canceled'])('treats %s as terminal', (state) => {
      expect(isAssistantInvestigationTerminal(state)).toBe(true);
    });

    it.each(['pending', 'in_progress', 'paused', 'weird-future-state', undefined, ''])(
      'treats %s as non-terminal',
      (state) => {
        expect(isAssistantInvestigationTerminal(state)).toBe(false);
      }
    );
  });

  describe('getAssistantInvestigationUrl', () => {
    it('builds a plugin bridge URL with an encoded investigation id', () => {
      expect(getAssistantInvestigationUrl('inv/123')).toBe('/a/grafana-assistant-app/investigations/inv%2F123');
    });
  });
});
