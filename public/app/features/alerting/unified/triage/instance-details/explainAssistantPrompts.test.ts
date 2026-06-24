import { buildExplainAssistantQuestions } from './explainAssistantPrompts';

const mockAssistantContext = [{ node: { id: 'alert-context' } }];

describe('buildExplainAssistantQuestions', () => {
  it('returns three triage-specific suggested prompts with alert context', () => {
    const questions = buildExplainAssistantQuestions(mockAssistantContext);

    expect(questions).toHaveLength(3);
    expect(questions.map((q) => q.title)).toEqual([
      'Show me similar alerts',
      'Show me the affected systems',
      'Show me incident/IRM history',
    ]);

    for (const question of questions) {
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.context).toBe(mockAssistantContext);
    }

    expect(questions[0].prompt).toMatch(/similar/i);
    expect(questions[0].prompt).toMatch(/10/);
    expect(questions[1].prompt).toMatch(/affected systems/i);
    expect(questions[2].prompt).toMatch(/IRM|incident/i);
  });
});
