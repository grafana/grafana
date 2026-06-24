import { buildExplainAssistantQuestions } from './explainAssistantPrompts';

const mockAssistantContext = [{ node: { id: 'alert-context' } }];

describe('buildExplainAssistantQuestions', () => {
  it('returns similar-alerts and affected-systems prompts with alert context', () => {
    const questions = buildExplainAssistantQuestions(mockAssistantContext);

    expect(questions).toHaveLength(2);
    expect(questions.map((q) => q.title)).toEqual(['Show me similar alerts', 'Show me the affected systems']);

    for (const question of questions) {
      expect(question.prompt.length).toBeGreaterThan(0);
      expect(question.context).toBe(mockAssistantContext);
    }

    expect(questions[0].prompt).toMatch(/alerting_manage_rules/i);
    expect(questions[0].prompt).toMatch(/10/);
    expect(questions[0].prompt).toMatch(/do not invent details/i);
    expect(questions[1].prompt).toMatch(/describe_infrastructure/i);
    expect(questions[1].prompt).toMatch(/Never guess label names/i);
  });

  it('omits the IRM prompt when incident history suggestions are disabled', () => {
    const questions = buildExplainAssistantQuestions(mockAssistantContext, {
      includeIncidentHistoryPrompt: false,
    });

    expect(questions).toHaveLength(2);
  });

  it('includes the stub IRM prompt when IRM is available but no linked history exists', () => {
    const questions = buildExplainAssistantQuestions(mockAssistantContext, {
      includeIncidentHistoryPrompt: true,
      hasLinkedIncidentHistory: false,
    });

    expect(questions).toHaveLength(3);
    expect(questions[2].title).toBe('Show me incident/IRM history');
    expect(questions[2].prompt).toMatch(/not yet linked to this rule/i);
  });

  it('includes the linked-history IRM prompt when incident history is present in context', () => {
    const questions = buildExplainAssistantQuestions(mockAssistantContext, {
      includeIncidentHistoryPrompt: true,
      hasLinkedIncidentHistory: true,
    });

    expect(questions).toHaveLength(3);
    expect(questions[2].prompt).toMatch(/incident history attached to this alert instance context/i);
  });
});
