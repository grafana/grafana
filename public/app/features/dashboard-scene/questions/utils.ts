import { type QuestionsOwner, type QuestionsOwnerKind } from '../sidebar/questions/types';

import { type SceneQuestion } from './types';

/** What viewers see for a question on the dashboard: its title, or the question itself when it has none. */
export function getQuestionLabel(question: SceneQuestion): string {
  return question.title?.trim() || question.text;
}

/** Whether a question shows in the dashboard controls menu, rather than above the panels. */
export function isInControlsMenu(question: SceneQuestion): boolean {
  return question.placement === 'inControlsMenu';
}

/** `question` placed in the controls menu, or above the panels when `inMenu` is false. */
export function withQuestionPlacement(question: SceneQuestion, inMenu: boolean): SceneQuestion {
  const { placement: _, ...rest } = question;
  return inMenu ? { ...rest, placement: 'inControlsMenu' } : rest;
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
