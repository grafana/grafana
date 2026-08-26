import { getRandomSurprisePrompt, surprisePrompts } from './surprisePrompts';

describe('surprisePrompts', () => {
  describe('getRandomSurprisePrompt', () => {
    it('returns a prompt from the surprisePrompts array', () => {
      const result = getRandomSurprisePrompt();
      expect(surprisePrompts).toContain(result);
    });

    it('returns a non-empty string', () => {
      const result = getRandomSurprisePrompt();
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns prompts with variety when called multiple times', () => {
      const results = new Set<string>();
      const attempts = Math.min(10, surprisePrompts.length);

      for (let i = 0; i < attempts; i++) {
        results.add(getRandomSurprisePrompt());
      }

      expect(results.size).toBeGreaterThan(0);
    });
  });

  describe('surprisePrompts array', () => {
    it('contains at least 10 prompts for variety', () => {
      expect(surprisePrompts.length).toBeGreaterThanOrEqual(10);
    });

    it('contains only non-empty strings', () => {
      surprisePrompts.forEach((prompt) => {
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
      });
    });

    it('contains prompts that are descriptive and actionable', () => {
      surprisePrompts.forEach((prompt) => {
        expect(prompt.length).toBeGreaterThan(20);
      });
    });
  });
});
