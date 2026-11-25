import { type DropResult } from '@hello-pangea/dnd';
import { useCallback, useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { useDragAndDrop } from '@grafana/ui/internal';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { type SceneQuestion } from '../../questions/types';
import { getQuestionLabel, isInControlsMenu, withQuestionPlacement } from '../../questions/utils';
import { useCanEditQuestions } from '../../scene/DashboardControlsExtensionPoint';
import { DraggableList, DraggableListItems } from '../dashboard/DraggableList';
import { SidebarAddButton } from '../dashboard/SidebarAddButton';
import { toDraggableListItemActions } from '../dashboard/helpers';
import { SidebarCategoryType } from '../types';

import { AiSparkleIcon } from './AiSparkleIcon';
import { duplicateQuestion, openAddQuestionPane, openEditQuestionPane, QuestionEdit } from './QuestionEdit';
import { questionActions } from './actions';
import { type QuestionsOwner, type QuestionsOwnerKind } from './types';

const CATEGORY_IDS: Record<QuestionsOwnerKind, SidebarCategoryType> = {
  dashboard: SidebarCategoryType.DashboardQuestions,
  row: SidebarCategoryType.RowQuestions,
  tab: SidebarCategoryType.TabQuestions,
};

/**
 * The "Questions" category of a dashboard's, row's, or tab's options, laid out like "Links": a count, an add
 * button, and a list to reorder, edit, duplicate, or delete questions, which on a dashboard is split into the
 * questions above it and those in its controls menu. Empty unless editors can edit questions (see
 * `useCanEditQuestions`).
 */
export function useQuestionsCategory(
  owner: QuestionsOwner,
  ownerKind: QuestionsOwnerKind
): OptionsPaneCategoryDescriptor[] {
  const enabled = useCanEditQuestions(owner);
  const { questions } = owner.useState();
  const listId = useId();
  const count = questions?.length ?? 0;

  return useMemo(() => {
    if (!enabled) {
      return [];
    }

    const title = t('dashboard.sidebar.questions.title', 'Questions');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: CATEGORY_IDS[ownerKind],
      headerActions: <AddQuestionButton owner={owner} ownerKind={ownerKind} />,
      itemsCount: count,
      renderTitle: () => <QuestionsCategoryTitle title={title} />,
      isDashboardSidebar: true,
    });

    if (count) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: listId,
          skipField: true,
          render: () => <QuestionsList owner={owner} ownerKind={ownerKind} />,
        })
      );
    }

    return [category];
  }, [count, enabled, listId, owner, ownerKind]);
}

// Questions made Scene-like for DraggableListItems, keyed by their index.
type QuestionItem = SceneQuestion & { state: { key: string; name: string } };

/**
 * The questions to reorder, edit, duplicate, or delete. A dashboard's are split into the ones above it and the ones in
 * its controls menu, and dragging one to the other list moves it there, as for links. A row or tab has no controls
 * menu, so it keeps its questions in one list.
 */
export function QuestionsList({ owner, ownerKind }: { owner: QuestionsOwner; ownerKind: QuestionsOwnerKind }) {
  const { DragDropContext, Droppable } = useDragAndDrop();
  const { questions } = owner.useState();
  const droppableId = `${CATEGORY_IDS[ownerKind]}-list`;
  const controlsMenuDroppableId = `${droppableId}-controls-menu`;
  const hasControlsMenu = ownerKind === 'dashboard';

  const { above, controlsMenu } = useMemo(() => {
    const items = (questions ?? []).map(
      (question, index): QuestionItem => ({
        ...question,
        state: { key: String(index), name: getQuestionLabel(question) },
      })
    );
    return hasControlsMenu
      ? { above: items.filter((item) => !isInControlsMenu(item)), controlsMenu: items.filter(isInControlsMenu) }
      : { above: items, controlsMenu: [] };
  }, [questions, hasControlsMenu]);

  const actions = toDraggableListItemActions<QuestionItem>(
    (item) => openEditQuestionPane(owner, ownerKind, Number(item.state.key)),
    (item) => duplicateQuestion(owner, ownerKind, Number(item.state.key)),
    (item) =>
      new QuestionEdit({
        ownerRef: owner.getRef(),
        ownerKind,
        questionIndex: Number(item.state.key),
      }).onConfirmDelete()
  );

  const onDragEnd = useCallback(
    ({ source, destination }: DropResult) => {
      if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) {
        return;
      }

      const lists = { [droppableId]: [...above], [controlsMenuDroppableId]: [...controlsMenu] };
      const [moved] = lists[source.droppableId].splice(source.index, 1);
      lists[destination.droppableId].splice(destination.index, 0, moved);

      const toQuestion = ({ state: _, ...question }: QuestionItem): SceneQuestion => question;
      questionActions.reorder({
        owner,
        next: hasControlsMenu
          ? [
              ...lists[droppableId].map((item) => withQuestionPlacement(toQuestion(item), false)),
              ...lists[controlsMenuDroppableId].map((item) => withQuestionPlacement(toQuestion(item), true)),
            ]
          : lists[droppableId].map(toQuestion),
      });
    },
    [owner, above, controlsMenu, droppableId, controlsMenuDroppableId, hasControlsMenu]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {hasControlsMenu ? (
        <>
          <DraggableList
            items={above}
            droppableId={droppableId}
            title={t('dashboard.sidebar.questions.title-above-dashboard', 'Above dashboard')}
            renderItemLabel={renderItemLabel}
            {...actions}
          />
          <DraggableList
            items={controlsMenu}
            droppableId={controlsMenuDroppableId}
            title={t('dashboard.sidebar.questions.title-controls-menu', 'Controls menu')}
            renderItemLabel={renderItemLabel}
            {...actions}
          />
        </>
      ) : (
        <Droppable droppableId={droppableId} direction="vertical">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              <DraggableListItems items={above} testId={droppableId} renderItemLabel={renderItemLabel} {...actions} />
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      )}
    </DragDropContext>
  );
}

const renderItemLabel = (question: QuestionItem) => (
  <span data-testid="question-text">
    {question.state.name || t('dashboard.sidebar.questions.new-question', 'New question')}
  </span>
);

/** Marks questions as an Assistant feature, as the controls that run them do. */
function QuestionsCategoryTitle({ title }: { title: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <AiSparkleIcon />
      <span>{title}</span>
    </Stack>
  );
}

function AddQuestionButton({ owner, ownerKind }: { owner: QuestionsOwner; ownerKind: QuestionsOwnerKind }) {
  const onAdd = useCallback(() => openAddQuestionPane(owner, ownerKind), [owner, ownerKind]);

  return <SidebarAddButton onAdd={onAdd} tooltip={t('dashboard.sidebar.questions.add-question', 'Add question')} />;
}
