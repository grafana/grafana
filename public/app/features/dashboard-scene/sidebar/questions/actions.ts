import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { edit } from '../../actions/utils/edit';
import { type SceneQuestion } from '../../questions/types';

import { type QuestionsOwner } from './types';

/** Undoable changes to the questions saved on a dashboard, row, or tab. */
export const questionActions = {
  add({ owner, question, addedObject }: { owner: QuestionsOwner; question: SceneQuestion; addedObject?: SceneObject }) {
    const before = owner.state.questions;

    edit({
      meta: { actionId: 'question.add' },
      description: t('dashboard-scene.question-actions.add', 'Add question'),
      source: owner,
      addedObject,
      perform: () => owner.setState({ questions: [...(before ?? []), question] }),
      undo: () => owner.setState({ questions: before }),
    });
  },

  remove({ owner, index }: { owner: QuestionsOwner; index: number }) {
    const before = owner.state.questions;

    edit({
      meta: { actionId: 'question.remove' },
      description: t('dashboard-scene.question-actions.remove', 'Remove question'),
      source: owner,
      perform: () => owner.setState({ questions: (before ?? []).filter((_, i) => i !== index) }),
      undo: () => owner.setState({ questions: before }),
    });
  },

  update({
    owner,
    index,
    previous,
    next,
  }: {
    owner: QuestionsOwner;
    index: number;
    previous: SceneQuestion;
    next: SceneQuestion;
  }) {
    const replace = (question: SceneQuestion) => {
      const questions = [...(owner.state.questions ?? [])];
      questions[index] = question;
      owner.setState({ questions });
    };

    edit({
      meta: { actionId: 'question.change' },
      description: t('dashboard-scene.question-actions.update', 'Change question'),
      source: owner,
      perform: () => replace(next),
      undo: () => replace(previous),
    });
  },

  /** Saves `next`, the same questions in a new order, one of which can have a new placement. */
  reorder({ owner, next }: { owner: QuestionsOwner; next: SceneQuestion[] }) {
    const before = owner.state.questions;

    edit({
      meta: { actionId: 'question.reorder' },
      description: t('dashboard-scene.question-actions.reorder', 'Reorder questions'),
      source: owner,
      perform: () => owner.setState({ questions: next }),
      undo: () => owner.setState({ questions: before }),
    });
  },
};
