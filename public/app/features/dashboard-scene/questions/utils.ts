import { type QuestionsOwner, type QuestionsOwnerKind } from '../sidebar/questions/types';

import { type SceneQuestion } from './types';

/** What viewers see for a question on the dashboard: its title, or the question itself when it has none. */
export function getQuestionLabel(question: SceneQuestion): string {
  return question.title?.trim() || question.text;
}

/**
 * The key of the object that edits a question in the sidebar. The question's control on the dashboard shows as
 * selected while the sidebar has that key selected.
 */
export function getQuestionSelectionId(
  owner: QuestionsOwner,
  ownerKind: QuestionsOwnerKind,
  questionIndex: number
): string {
  return `${owner.state.key ?? ownerKind}-question-${questionIndex}`;
}
