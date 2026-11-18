import { type DropResult } from '@hello-pangea/dnd';
import { useCallback, useId, useMemo } from 'react';

import { t } from '@grafana/i18n';
import { Stack } from '@grafana/ui';
import { useDragAndDrop } from '@grafana/ui/internal';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { type ScenePrompt } from '../../prompts/types';
import { getPromptLabel } from '../../prompts/utils';
import { useCanEditPrompts } from '../../scene/DashboardControlsExtensionPoint';
import { DraggableListItems } from '../dashboard/DraggableList';
import { SidebarAddButton } from '../dashboard/SidebarAddButton';
import { toDraggableListItemActions } from '../dashboard/helpers';
import { SidebarCategoryType } from '../types';

import { AiSparkleIcon } from './AiSparkleIcon';
import { duplicatePrompt, openAddPromptPane, openEditPromptPane, PromptEdit } from './PromptEdit';
import { promptActions } from './actions';
import { type PromptsOwner, type PromptsOwnerKind } from './types';

const CATEGORY_IDS: Record<PromptsOwnerKind, SidebarCategoryType> = {
  dashboard: SidebarCategoryType.DashboardPrompts,
  row: SidebarCategoryType.RowPrompts,
  tab: SidebarCategoryType.TabPrompts,
};

/**
 * The "Prompts" category of a dashboard's, row's, or tab's options, laid out like "Links": a count, an add
 * button, and a list to reorder, edit, duplicate, or delete prompts. Empty unless editors can edit prompts (see
 * `useCanEditPrompts`).
 */
export function usePromptsCategory(owner: PromptsOwner, ownerKind: PromptsOwnerKind): OptionsPaneCategoryDescriptor[] {
  const enabled = useCanEditPrompts(owner);
  const { prompts } = owner.useState();
  const listId = useId();
  const count = prompts?.length ?? 0;

  return useMemo(() => {
    if (!enabled) {
      return [];
    }

    const title = t('dashboard.sidebar.prompts.title', 'Questions');
    const category = new OptionsPaneCategoryDescriptor({
      title,
      id: CATEGORY_IDS[ownerKind],
      headerActions: <AddPromptButton owner={owner} ownerKind={ownerKind} />,
      itemsCount: count,
      renderTitle: () => <PromptsCategoryTitle title={title} />,
      isDashboardSidebar: true,
    });

    if (count) {
      category.addItem(
        new OptionsPaneItemDescriptor({
          title: '',
          id: listId,
          skipField: true,
          render: () => <PromptsList owner={owner} ownerKind={ownerKind} />,
        })
      );
    }

    return [category];
  }, [count, enabled, listId, owner, ownerKind]);
}

// Prompts made Scene-like for DraggableListItems, keyed by their index.
type PromptItem = ScenePrompt & { state: { key: string; name: string } };

export function PromptsList({ owner, ownerKind }: { owner: PromptsOwner; ownerKind: PromptsOwnerKind }) {
  const { DragDropContext, Droppable } = useDragAndDrop();
  const { prompts } = owner.useState();
  const droppableId = `${CATEGORY_IDS[ownerKind]}-list`;

  const items = useMemo(
    () =>
      (prompts ?? []).map(
        (prompt, index): PromptItem => ({
          ...prompt,
          state: { key: String(index), name: getPromptLabel(prompt) },
        })
      ),
    [prompts]
  );

  const actions = toDraggableListItemActions<PromptItem>(
    (item) => openEditPromptPane(owner, ownerKind, Number(item.state.key)),
    (item) => duplicatePrompt(owner, ownerKind, Number(item.state.key)),
    (item) =>
      new PromptEdit({
        ownerRef: owner.getRef(),
        ownerKind,
        promptIndex: Number(item.state.key),
      }).onConfirmDelete()
  );

  const onDragEnd = useCallback(
    ({ source, destination }: DropResult) => {
      if (destination && destination.index !== source.index) {
        promptActions.move({ owner, from: source.index, to: destination.index });
      }
    },
    [owner]
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId={droppableId} direction="vertical">
        {(provided) => (
          <div ref={provided.innerRef} {...provided.droppableProps}>
            <DraggableListItems items={items} testId={droppableId} renderItemLabel={renderItemLabel} {...actions} />
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}

const renderItemLabel = (prompt: PromptItem) => (
  <span data-testid="prompt-text">
    {prompt.state.name || t('dashboard.sidebar.prompts.new-prompt', 'New question')}
  </span>
);

/** Marks prompts as an Assistant feature, as the controls that run them do. */
function PromptsCategoryTitle({ title }: { title: string }) {
  return (
    <Stack direction="row" alignItems="center" gap={1}>
      <AiSparkleIcon />
      <span>{title}</span>
    </Stack>
  );
}

function AddPromptButton({ owner, ownerKind }: { owner: PromptsOwner; ownerKind: PromptsOwnerKind }) {
  const onAdd = useCallback(() => openAddPromptPane(owner, ownerKind), [owner, ownerKind]);

  return <SidebarAddButton onAdd={onAdd} tooltip={t('dashboard.sidebar.prompts.add-prompt', 'Add question')} />;
}
