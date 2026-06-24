import { useEffect } from 'react';

import { unregisterExplainAssistantQuestions } from './instance-details/registerExplainAssistantQuestions';

/** Clears explain-drawer question registrations when leaving Alert Activity. */
export function ExplainAssistantQuestionsCleanup() {
  useEffect(() => () => unregisterExplainAssistantQuestions(), []);

  return null;
}
