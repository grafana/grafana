import { type Question, provideQuestions } from '@grafana/assistant';

import { EXPLAIN_ASSISTANT_QUESTIONS_URL } from './explainAssistantPrompts';

let unregisterQuestions: (() => void) | undefined;

export function registerExplainAssistantQuestions(questions: Question[]): void {
  unregisterExplainAssistantQuestions();

  const setQuestions = provideQuestions(EXPLAIN_ASSISTANT_QUESTIONS_URL, questions);
  unregisterQuestions = setQuestions.unregister;
}

export function unregisterExplainAssistantQuestions(): void {
  unregisterQuestions?.();
  unregisterQuestions = undefined;
}
