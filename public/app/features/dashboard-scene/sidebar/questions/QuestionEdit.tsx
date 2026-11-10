import { useId, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { Field, Input } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { useSidebarInputAutoFocus } from '../../scene/layouts-shared/utils';
import {
  type EditableDashboardElement,
  type EditableDashboardElementInfo,
} from '../../scene/types/EditableDashboardElement';
import { getDashboardSceneFor } from '../../utils/utils';

import { QuestionPanelsPicker } from './QuestionPanelsPicker';
import { questionActions } from './actions';
import { type QuestionsOwner, type QuestionsOwnerKind } from './types';

interface QuestionEditState extends SceneObjectState {
  ownerRef: SceneObjectRef<QuestionsOwner>;
  ownerKind: QuestionsOwnerKind;
  questionIndex: number;
}

/**
 * One question being edited in the sidebar, like a dashboard link. It isn't part of the scene graph: the
 * question lives in its owner's `questions`, at `questionIndex`.
 */
export class QuestionEdit extends SceneObjectBase<QuestionEditState> implements EditableDashboardElement {
  public readonly isEditableDashboardElement = true;

  public getEditableElementInfo(): EditableDashboardElementInfo {
    return {
      typeName: t('dashboard.sidebar.elements.question', 'Question'),
      icon: 'question-circle',
      instanceName: this.getQuestion()?.text || t('dashboard.sidebar.questions.new-question', 'New question'),
    };
  }

  public useSidebarOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    return useQuestionOptions.call(this, isNewElement);
  }

  public onDuplicate() {
    duplicateQuestion(this.getOwner(), this.state.ownerKind, this.state.questionIndex);
  }

  public onConfirmDelete() {
    const name = this.getQuestion()?.text || t('dashboard.sidebar.questions.new-question', 'New question');
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard-scene.question-edit.delete-title', 'Delete question'),
        text: t('dashboard-scene.question-edit.delete-text', 'Are you sure you want to delete: {{name}}?', {
          name,
        }),
        yesText: t('dashboard-scene.question-edit.delete-confirm', 'Delete question'),
        onConfirm: () => this.onDelete(),
      })
    );
  }

  public onDelete() {
    const owner = this.getOwner();
    const { questionIndex } = this.state;

    if (questionIndex >= 0 && questionIndex < (owner.state.questions ?? []).length) {
      questionActions.remove({ owner, index: questionIndex });
    }
    getDashboardSceneFor(owner).state.sidebar.selectObject(owner);
  }

  private getOwner(): QuestionsOwner {
    return this.state.ownerRef.resolve();
  }

  private getQuestion(): Question | undefined {
    return this.getOwner().state.questions?.[this.state.questionIndex];
  }
}

function createQuestionEdit(owner: QuestionsOwner, ownerKind: QuestionsOwnerKind, questionIndex: number): QuestionEdit {
  return new QuestionEdit({
    ownerRef: owner.getRef(),
    ownerKind,
    questionIndex,
    key: `${owner.state.key ?? ownerKind}-question-${questionIndex}`,
  });
}

export function openEditQuestionPane(owner: QuestionsOwner, ownerKind: QuestionsOwnerKind, questionIndex: number) {
  const element = createQuestionEdit(owner, ownerKind, questionIndex);
  getDashboardSceneFor(owner).state.sidebar.selectObject(element, { force: true, multi: false });
}

/** Adds an empty question and opens it, with the question field focused. */
export function openAddQuestionPane(owner: QuestionsOwner, ownerKind: QuestionsOwnerKind) {
  const questionIndex = (owner.state.questions ?? []).length;
  questionActions.add({
    owner,
    question: { text: '' },
    addedObject: createQuestionEdit(owner, ownerKind, questionIndex),
  });
}

export function duplicateQuestion(owner: QuestionsOwner, ownerKind: QuestionsOwnerKind, questionIndex: number) {
  const questions = owner.state.questions ?? [];
  const question = questions[questionIndex];
  if (!question) {
    return;
  }

  questionActions.add({
    owner,
    question: { ...question, text: `${question.text} - Copy` },
    addedObject: createQuestionEdit(owner, ownerKind, questions.length),
  });
  openEditQuestionPane(owner, ownerKind, questions.length);
}

function useQuestionOptions(this: QuestionEdit, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const questionEdit = this;
  const categoryId = useId();
  const textId = useId();
  const sourcesId = useId();

  return useMemo(
    () => [
      new OptionsPaneCategoryDescriptor({ title: '', id: categoryId })
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: textId,
            render: () => <QuestionTextInput questionEdit={questionEdit} autoFocus={isNewElement} />,
          })
        )
        .addItem(
          new OptionsPaneItemDescriptor({
            title: '',
            id: sourcesId,
            render: () => <QuestionSourcesField questionEdit={questionEdit} />,
          })
        ),
    ],
    [categoryId, textId, sourcesId, questionEdit, isNewElement]
  );
}

const SOURCES_DESCRIPTIONS: Record<QuestionsOwnerKind, () => string> = {
  dashboard: () =>
    t(
      'dashboard.sidebar.questions.sources.description-dashboard',
      'With none picked, the question is answered from every panel on this dashboard.'
    ),
  row: () =>
    t(
      'dashboard.sidebar.questions.sources.description-row',
      'With none picked, the question is answered from every panel in this row.'
    ),
  tab: () =>
    t(
      'dashboard.sidebar.questions.sources.description-tab',
      'With none picked, the question is answered from every panel in this tab.'
    ),
};

/** Picks the panels a question is answered from. Each change is one undoable edit. */
export function QuestionSourcesField({ questionEdit }: { questionEdit: QuestionEdit }) {
  const { ownerRef, ownerKind, questionIndex } = questionEdit.useState();
  const owner = ownerRef.resolve();
  const { questions } = owner.useState();
  const question = questions?.[questionIndex];

  if (!question) {
    return null;
  }

  const onChange = (panelIds: number[]) => {
    const { sources: _, ...rest } = question;
    questionActions.update({
      owner,
      index: questionIndex,
      previous: question,
      next: panelIds.length ? { ...rest, sources: panelIds.map((panelId) => ({ panelId })) } : rest,
    });
  };

  return (
    <Field
      label={t('dashboard.sidebar.questions.sources.label', 'Source panels')}
      description={SOURCES_DESCRIPTIONS[ownerKind]()}
      noMargin
    >
      <QuestionPanelsPicker
        dashboard={getDashboardSceneFor(owner)}
        value={(question.sources ?? []).map((source) => source.panelId)}
        onChange={onChange}
      />
    </Field>
  );
}

const QUESTION_DESCRIPTIONS: Record<QuestionsOwnerKind, () => string> = {
  dashboard: () => t('dashboard.sidebar.questions.description-dashboard', 'Viewers can ask it about this dashboard.'),
  row: () => t('dashboard.sidebar.questions.description-row', 'Viewers can ask it about the panels in this row.'),
  tab: () => t('dashboard.sidebar.questions.description-tab', 'Viewers can ask it about the panels in this tab.'),
};

/** Changes the question as the author types, and records one undoable change when the field loses focus. */
export function QuestionTextInput({ questionEdit, autoFocus }: { questionEdit: QuestionEdit; autoFocus?: boolean }) {
  const { ownerRef, ownerKind, questionIndex } = questionEdit.useState();
  const owner = ownerRef.resolve();
  const { questions } = owner.useState();
  const question = questions?.[questionIndex];
  const ref = useSidebarInputAutoFocus({ autoFocus });
  const id = useId();
  const textOnFocus = useRef(question?.text ?? '');

  if (!question) {
    return null;
  }

  return (
    <Field
      label={t('dashboard.sidebar.questions.question', 'Question')}
      description={QUESTION_DESCRIPTIONS[ownerKind]()}
      noMargin
    >
      <Input
        id={id}
        ref={ref}
        value={question.text}
        placeholder={t('dashboard.sidebar.questions.placeholder', 'What changed since the previous period?')}
        onFocus={() => {
          textOnFocus.current = question.text;
        }}
        onChange={(event) => {
          const questions = [...(owner.state.questions ?? [])];
          questions[questionIndex] = { ...question, text: event.currentTarget.value };
          owner.setState({ questions });
        }}
        onBlur={() => {
          if (textOnFocus.current !== question.text) {
            questionActions.update({
              owner,
              index: questionIndex,
              previous: { ...question, text: textOnFocus.current },
              next: question,
            });
          }
        }}
      />
    </Field>
  );
}
