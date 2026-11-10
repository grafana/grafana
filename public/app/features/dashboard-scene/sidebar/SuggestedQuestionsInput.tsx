import { useState } from 'react';

import { t } from '@grafana/i18n';
import { type SuggestedQuestion } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { TextArea } from '@grafana/ui';

import { edit } from '../actions/utils/edit';
import { type DashboardScene } from '../scene/DashboardScene';
import { type RowItem } from '../scene/layout-rows/RowItem';
import { type TabItem } from '../scene/layout-tabs/TabItem';

interface Props {
  id?: string;
  /** The dashboard, row, or tab the questions are saved on. */
  owner: DashboardScene | RowItem | TabItem;
  /** Names the edit in undo and redo. */
  element: 'dashboard' | 'row' | 'tab';
}

/** Edits the suggested questions saved on a dashboard, row, or tab: one per line, applied when the field loses focus. */
export function SuggestedQuestionsInput({ id, owner, element }: Props) {
  const { suggestedQuestions } = owner.useState();
  // Set only while the author types, so the field shows the saved questions again after an undo or redo.
  const [draft, setDraft] = useState<string>();

  const onBlur = () => {
    if (draft === undefined) {
      return;
    }
    setDraft(undefined);

    const previous = suggestedQuestions ?? [];
    const next = parseQuestions(draft, previous);
    if (next.length === previous.length && next.every((question, index) => question === previous[index])) {
      return;
    }

    edit({
      meta: { actionId: `${element}.changeQuestions` },
      description: t('dashboard.edit-actions.change-questions', 'Change suggested questions'),
      source: owner,
      perform: () => owner.setState({ suggestedQuestions: next.length ? next : undefined }),
      undo: () => owner.setState({ suggestedQuestions }),
    });
  };

  return (
    <TextArea
      id={id}
      rows={3}
      value={draft ?? (suggestedQuestions ?? []).map((question) => question.text).join('\n')}
      placeholder={t('dashboard.sidebar.suggested-questions.placeholder', 'What changed since the previous period?')}
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={onBlur}
    />
  );
}

/**
 * One question per non-blank line, without repeats. A line that matches a saved question keeps that question, so its
 * other settings survive the edit.
 */
function parseQuestions(text: string, saved: SuggestedQuestion[]): SuggestedQuestion[] {
  const savedByText = new Map(saved.map((question) => [question.text, question]));
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return [...new Set(lines)].map((line) => savedByText.get(line) ?? { text: line });
}
