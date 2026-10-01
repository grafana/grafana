import { nanoid } from 'nanoid';

import { t } from '@grafana/i18n';

import { edit } from '../../actions/utils/edit';

import {
  getInsightsAnnotation,
  type InsightsDashboard,
  serializeInsightQuestions,
  writeInsightsAnnotation,
} from './insightsStorage';
import { type InsightQuestion } from './types';

export type InsightQuestionDraft = Omit<InsightQuestion, 'id'>;

/** Undo restores the raw previous value, so an unreadable annotation is not lost by undoing. */
function commitInsightQuestions(dashboard: InsightsDashboard, next: InsightQuestion[], description: string) {
  const previousValue = getInsightsAnnotation(dashboard);
  const nextValue = serializeInsightQuestions(next);
  if (previousValue === nextValue) {
    return;
  }
  edit({
    source: dashboard,
    description,
    perform: () => writeInsightsAnnotation(dashboard, nextValue),
    undo: () => writeInsightsAnnotation(dashboard, previousValue),
  });
}

/** Returns the new question's id. */
export function addInsightQuestion(
  dashboard: InsightsDashboard,
  questions: InsightQuestion[],
  draft: InsightQuestionDraft
): string {
  const id = nanoid();
  commitInsightQuestions(
    dashboard,
    [...questions, { id, ...draft }],
    t('dashboard.insights.edit-action.add', 'Add insight question')
  );
  return id;
}

export function updateInsightQuestion(
  dashboard: InsightsDashboard,
  questions: InsightQuestion[],
  id: string,
  draft: InsightQuestionDraft
) {
  commitInsightQuestions(
    dashboard,
    // Replaced rather than merged, so a setting the draft turned off does not survive the edit.
    questions.map((question) => (question.id === id ? { id, ...draft } : question)),
    t('dashboard.insights.edit-action.edit', 'Edit insight question')
  );
}

export function moveInsightQuestion(
  dashboard: InsightsDashboard,
  questions: InsightQuestion[],
  index: number,
  offset: -1 | 1
) {
  const target = index + offset;
  if (index < 0 || target < 0 || index >= questions.length || target >= questions.length) {
    return;
  }
  const next = [...questions];
  [next[index], next[target]] = [next[target], next[index]];
  commitInsightQuestions(dashboard, next, t('dashboard.insights.edit-action.move', 'Move insight question'));
}

export function deleteInsightQuestion(dashboard: InsightsDashboard, questions: InsightQuestion[], id: string) {
  commitInsightQuestions(
    dashboard,
    questions.filter((question) => question.id !== id),
    t('dashboard.insights.edit-action.delete', 'Delete insight question')
  );
}
