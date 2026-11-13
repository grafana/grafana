import { type FormEvent, useId, useMemo, useRef } from 'react';

import { t } from '@grafana/i18n';
import { SceneObjectBase, type SceneObjectRef, type SceneObjectState } from '@grafana/scenes';
import { Field, Input, TextArea } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';
import { ShowConfirmModalEvent } from 'app/types/events';

import { type SceneQuestion } from '../../questions/types';
import { getQuestionLabel, getQuestionSelectionId } from '../../questions/utils';
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
      icon: 'ai-sparkle',
      instanceName: this.getName(),
    };
  }

  public useSidebarOptions(isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
    return useQuestionOptions.call(this, isNewElement);
  }

  public onDuplicate() {
    duplicateQuestion(this.getOwner(), this.state.ownerKind, this.state.questionIndex);
  }

  public onConfirmDelete() {
    const name = this.getName();
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

  private getQuestion(): SceneQuestion | undefined {
    return this.getOwner().state.questions?.[this.state.questionIndex];
  }

  private getName(): string {
    const question = this.getQuestion();
    return (question && getQuestionLabel(question)) || t('dashboard.sidebar.questions.new-question', 'New question');
  }
}

function createQuestionEdit(owner: QuestionsOwner, ownerKind: QuestionsOwnerKind, questionIndex: number): QuestionEdit {
  return new QuestionEdit({
    ownerRef: owner.getRef(),
    ownerKind,
    questionIndex,
    key: getQuestionSelectionId(owner, ownerKind, questionIndex),
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

  // Viewers tell the copy apart by its label. The question asked stays the same, unless it is the label.
  const copy = question.title?.trim()
    ? { ...question, title: `${question.title} - Copy` }
    : { ...question, text: `${question.text} - Copy` };
  questionActions.add({
    owner,
    question: copy,
    addedObject: createQuestionEdit(owner, ownerKind, questions.length),
  });
  openEditQuestionPane(owner, ownerKind, questions.length);
}

function useQuestionOptions(this: QuestionEdit, isNewElement: boolean): OptionsPaneCategoryDescriptor[] {
  const questionEdit = this;
  const categoryId = useId();
  const textId = useId();
  const titleId = useId();
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
            id: titleId,
            render: () => <QuestionTitleInput questionEdit={questionEdit} />,
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
    [categoryId, textId, titleId, sourcesId, questionEdit, isNewElement]
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

type QuestionStringProp = 'text' | 'title';

/** `question` with `prop` set to `value`. An empty title is left out, so the question shows instead. */
function withQuestionProp(question: SceneQuestion, prop: QuestionStringProp, value: string): SceneQuestion {
  if (prop === 'title' && !value) {
    const { title: _, ...rest } = question;
    return rest;
  }
  return { ...question, [prop]: value };
}

/**
 * Edits one of a question's texts: changes it as the author types, and records one undoable change when the field
 * loses focus. Undefined once the question is removed.
 */
function useQuestionStringProp(questionEdit: QuestionEdit, prop: QuestionStringProp) {
  const { ownerRef, ownerKind, questionIndex } = questionEdit.useState();
  const owner = ownerRef.resolve();
  const { questions } = owner.useState();
  const question = questions?.[questionIndex];
  const valueOnFocus = useRef(question?.[prop] ?? '');

  if (!question) {
    return undefined;
  }

  return {
    ownerKind,
    value: question[prop] ?? '',
    onFocus: () => {
      valueOnFocus.current = question[prop] ?? '';
    },
    onChange: (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const questions = [...(owner.state.questions ?? [])];
      questions[questionIndex] = withQuestionProp(question, prop, event.currentTarget.value);
      owner.setState({ questions });
    },
    onBlur: () => {
      if (valueOnFocus.current !== (question[prop] ?? '')) {
        questionActions.update({
          owner,
          index: questionIndex,
          previous: withQuestionProp(question, prop, valueOnFocus.current),
          next: question,
        });
      }
    },
  };
}

/** The question that is asked. It can run long, since viewers see its title when it has one. */
export function QuestionTextInput({ questionEdit, autoFocus }: { questionEdit: QuestionEdit; autoFocus?: boolean }) {
  const editing = useQuestionStringProp(questionEdit, 'text');
  const ref = useSidebarInputAutoFocus<HTMLTextAreaElement>({ autoFocus });
  const id = useId();

  if (!editing) {
    return null;
  }

  const { ownerKind, ...field } = editing;

  return (
    <Field
      label={t('dashboard.sidebar.questions.question', 'Question')}
      description={QUESTION_DESCRIPTIONS[ownerKind]()}
      noMargin
    >
      <TextArea
        id={id}
        ref={ref}
        rows={3}
        placeholder={t('dashboard.sidebar.questions.placeholder', 'What changed since the previous period?')}
        {...field}
      />
    </Field>
  );
}

/** A short title viewers see on the dashboard instead of the question. */
export function QuestionTitleInput({ questionEdit }: { questionEdit: QuestionEdit }) {
  const editing = useQuestionStringProp(questionEdit, 'title');
  const id = useId();

  if (!editing) {
    return null;
  }

  const { ownerKind: _, ...field } = editing;

  return (
    <Field
      label={t('dashboard.sidebar.questions.question-title', 'Title')}
      description={t(
        'dashboard.sidebar.questions.question-title-description',
        'Viewers see it on the dashboard instead of the question. Leave it empty to show the question.'
      )}
      noMargin
    >
      <Input
        id={id}
        placeholder={t('dashboard.sidebar.questions.question-title-placeholder', 'What changed?')}
        {...field}
      />
    </Field>
  );
}
