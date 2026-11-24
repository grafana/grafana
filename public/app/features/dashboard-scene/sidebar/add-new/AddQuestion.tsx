import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { useCanEditQuestions } from '../../scene/DashboardControlsExtensionPoint';
import { type RowItem } from '../../scene/layout-rows/RowItem';
import { type TabItem } from '../../scene/layout-tabs/TabItem';
import { isRowItem, isTabItem } from '../../scene/types/LayoutItemTypeGuards';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { getDashboardSceneFor } from '../../utils/utils';
import { openAddQuestionPane, QuestionEdit } from '../questions/QuestionEdit';
import { type QuestionsOwner, type QuestionsOwnerKind } from '../questions/types';

import { AddButton } from './AddButton';

/** Adds a question to the row or tab the selection is in, or to the dashboard when it isn't in one. */
export function AddQuestion({
  dashboardScene,
  selectedElement,
}: {
  dashboardScene: DashboardSceneLike;
  selectedElement: SceneObject | undefined;
}) {
  const canAddQuestion = useCanEditQuestions(dashboardScene);

  const onAddQuestionClick = useCallback(() => {
    const { owner, ownerKind } = getQuestionsOwner(getDashboardSceneFor(dashboardScene), selectedElement);
    openAddQuestionPane(owner, ownerKind);
  }, [dashboardScene, selectedElement]);

  if (!canAddQuestion) {
    return null;
  }

  return (
    <AddButton
      icon="ai-sparkle"
      label={t('dashboard.sidebar.add.question.label', 'Question')}
      tooltip={t('dashboard.sidebar.add.question.tooltip', 'Add a question viewers can ask about the panels')}
      onClick={onAddQuestionClick}
    />
  );
}

function getQuestionsOwner(
  dashboard: QuestionsOwner,
  selectedElement: SceneObject | undefined
): { owner: QuestionsOwner; ownerKind: QuestionsOwnerKind } {
  // A question being edited isn't in the scene, so the row or tab it is saved on is read from it.
  if (selectedElement instanceof QuestionEdit) {
    return { owner: selectedElement.state.ownerRef.resolve(), ownerKind: selectedElement.state.ownerKind };
  }

  for (let element = selectedElement; element; element = element.parent) {
    if (isSection(element)) {
      return { owner: element, ownerKind: isTabItem(element) ? 'tab' : 'row' };
    }
  }

  return { owner: dashboard, ownerKind: 'dashboard' };
}

/**
 * Whether the element is a row or a tab. Read from their layout item type rather than with `instanceof`, which would
 * make this a dependency of their classes, the dashboard, and the sidebar that renders this pane.
 */
function isSection(element: SceneObject): element is RowItem | TabItem {
  return isRowItem(element) || isTabItem(element);
}
