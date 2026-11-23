import { useCallback } from 'react';

import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { useCanEditQuestions } from '../../scene/DashboardControlsExtensionPoint';
import { isTabItem } from '../../scene/types/LayoutItemTypeGuards';
import { type DashboardSceneLike } from '../../scene/types/dashboard';
import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
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

  const sectionOwner = dashboardSceneGraph.findSectionOwner(selectedElement);
  if (sectionOwner) {
    return { owner: sectionOwner, ownerKind: isTabItem(sectionOwner) ? 'tab' : 'row' };
  }

  return { owner: dashboard, ownerKind: 'dashboard' };
}
