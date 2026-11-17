import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';

import {
  type GrafanaTheme2,
  PluginExtensionPoints,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useFlagGrafanaDashboardQuestions } from '@grafana/runtime/internal';
import { sceneGraph, type SceneObject } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { getSourcePanels, type SourcePanel } from '../questions/sourcePanels';
import { type SceneQuestion } from '../questions/types';
import { getQuestionLabel, getQuestionSelectionId } from '../questions/utils';
import { V2DashboardSerializer } from '../serialization/DashboardSceneSerializer';
import { questionActions } from '../sidebar/questions/actions';
import { type QuestionsOwnerKind } from '../sidebar/questions/types';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getDashboardSceneFor, useDashboardState } from '../utils/utils';
import { getVizPanelKeyForPanelId } from '../utils/utils-panels';

import { type DashboardScene } from './DashboardScene';
import { isViewingDashboard } from './dashboardModes';
import { EditActionsPopover } from './edit-actions-popover/EditActionsPopover';
import { QuestionEditActions } from './edit-actions-popover/QuestionEditActions';
import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';
import { type DashboardSceneState, isFullDashboardEditing } from './types/dashboard';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

/** The dashboard, row, or tab whose saved questions the controls ask. */
type ControlsOwner = DashboardScene | RowItem | TabItem;

type Props =
  | {
      /** Renders the controls in the dashboard controls bar. */
      dashboard: DashboardScene;
      section?: never;
    }
  | {
      /** Renders the controls above the row's or tab's panels. */
      section: RowItem | TabItem;
      dashboard?: never;
    };

/** A saved question that viewers can ask, with its position in the saved list. */
interface AskableQuestion {
  question: SceneQuestion;
  index: number;
}

/**
 * Renders the components that plugins add to the `DashboardControls` extension point. They render in the dashboard
 * controls bar and above the panels of a row or tab. Each component receives the questions saved on that dashboard,
 * row, or tab, with the panels to answer them from.
 *
 * While the dashboard is edited, each question renders as its own control, rendered by the plugin with only that
 * question, which editors can select, duplicate, and delete like a link. Asking it there keeps it selected, so editors
 * can change it and ask again.
 *
 * Renders nothing when `grafana.dashboardQuestions` is off, when no saved question has text (a question just added
 * in the editor has none yet), or while the dashboard is neither viewed nor edited (see `getControlsMode`).
 *
 * Also renders nothing on a repeated row or tab after the first, or inside one. Repeat clones' panels have no stable
 * keys, so they're never passed on, and a later repeat's questions would be answered from the first repeat's panels.
 */
export function DashboardControlsExtensionPoint(props: Props) {
  const owner = props.section ?? props.dashboard;
  const enabled = useFlagGrafanaDashboardQuestions();
  const { questions } = owner.useState();
  const dashboardState = useDashboardState(owner);
  const askable = (questions ?? []).flatMap((question, index) => (question.text.trim() ? [{ question, index }] : []));
  const mode = getControlsMode(dashboardState);

  if (
    !enabled ||
    !askable.length ||
    !mode ||
    (mode === 'edit' && !savesQuestions(owner)) ||
    isRepeatCloneOrChildOf(owner)
  ) {
    return null;
  }

  return <ControlsComponents owner={owner} questions={askable} isEditing={mode === 'edit'} />;
}

function ControlsComponents({
  owner,
  questions,
  isEditing,
}: {
  owner: ControlsOwner;
  questions: AskableQuestion[];
  isEditing: boolean;
}) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = useDashboardControlsComponents();

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(
    owner,
    questions.map(({ question }) => question)
  );

  return (
    // Keeps a click on the control from selecting the row (see RowItemRenderer onPointerUp), and from clearing the
    // selection, so a question asked while it is edited stays open in the sidebar.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.container}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {isEditing
        ? context.questions.map((question, i) => (
            <EditableQuestion key={questions[i].index} owner={owner} saved={questions[i]}>
              {components.map((Component) => (
                <Component key={Component.meta.id} {...context} questions={[question]} />
              ))}
            </EditableQuestion>
          ))
        : components.map((Component) => <Component key={Component.meta.id} {...context} />)}
    </div>
  );
}

// The edit pane loads on first use, like the add flows in AddControlsButton.
const loadQuestionEdit = () =>
  import(/* webpackChunkName: "dashboard-add-controls" */ '../sidebar/questions/QuestionEdit');

/** A question's control while the dashboard is edited: selectable, with the actions links and variables have. */
function EditableQuestion({
  owner,
  saved: { question, index },
  children,
}: {
  owner: ControlsOwner;
  saved: AskableQuestion;
  children: ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const ownerKind = getOwnerKind(owner);
  const { isSelected, isSelectable } = useElementSelection(getQuestionSelectionId(owner, ownerKind, index));
  const { sidebar } = getDashboardSceneFor(owner).state;

  const onEdit = () =>
    sidebar.runPaneRequest(async (signal) => {
      const { openEditQuestionPane } = await loadQuestionEdit();
      if (!signal.aborted) {
        openEditQuestionPane(owner, ownerKind, index);
      }
    });

  const onDuplicate = () =>
    sidebar.runPaneRequest(async (signal) => {
      const { duplicateQuestion } = await loadQuestionEdit();
      if (!signal.aborted) {
        duplicateQuestion(owner, ownerKind, index);
      }
    });

  const onDelete = () => {
    questionActions.remove({ owner, index });
    // The sidebar would show whichever question moved into this one's place.
    if (isSelected) {
      sidebar.selectObject(owner);
    }
  };

  return (
    <EditActionsPopover
      content={
        <QuestionEditActions
          name={getQuestionLabel(question)}
          onClickEdit={onEdit}
          onClickDuplicate={onDuplicate}
          onClickDelete={onDelete}
        />
      }
    >
      <div
        className={cx(
          styles.question,
          isSelected && 'dashboard-selected-element',
          isSelectable && !isSelected && 'dashboard-selectable-element'
        )}
      >
        {children}
      </div>
    </EditActionsPopover>
  );
}

/**
 * How the controls show: as viewers see them, or one control per question while the dashboard is edited. Undefined
 * while a panel is edited, or a plan is previewed with placeholder panels that have no queries.
 */
function getControlsMode(state: DashboardSceneState): 'view' | 'edit' | undefined {
  if (state.editPanel || state.planning) {
    return undefined;
  }
  if (isViewingDashboard(state)) {
    return 'view';
  }
  return isFullDashboardEditing(state) ? 'edit' : undefined;
}

function getOwnerKind(owner: ControlsOwner): QuestionsOwnerKind {
  if (owner instanceof RowItem) {
    return 'row';
  }
  return owner instanceof TabItem ? 'tab' : 'dashboard';
}

/** Whether the dashboard saves questions: a v1 save drops them, and turns rows and tabs into v1 rows. */
function savesQuestions(object: SceneObject): boolean {
  return getDashboardSceneFor(object).serializer instanceof V2DashboardSerializer;
}

function useDashboardControlsComponents() {
  return usePluginComponents<PluginExtensionDashboardControlsContext>({
    extensionPointId: PluginExtensionPoints.DashboardControls,
    limitPerPlugin: COMPONENTS_LIMIT_PER_PLUGIN,
  });
}

/**
 * Whether editors can save questions: `grafana.dashboardQuestions` is on and a plugin adds a control
 * that offers them.
 */
export function useQuestionsEnabled(): boolean {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { components } = useDashboardControlsComponents();
  return enabled && components.length > 0;
}

/** Whether editors can add and change questions on the dashboard `object` is on (see `useQuestionsEnabled`). */
export function useCanEditQuestions(object: SceneObject): boolean {
  return useQuestionsEnabled() && savesQuestions(object);
}

function toControlsPanel({ key, title, panel }: SourcePanel): PluginExtensionDashboardControlsPanel {
  return { key, title: sceneGraph.interpolate(panel, title) };
}

function getControlsContext(owner: ControlsOwner, saved: SceneQuestion[]): PluginExtensionDashboardControlsContext {
  const dashboard = getDashboardSceneFor(owner);
  const sources = getSourcePanels(dashboard);
  const isSection = owner instanceof RowItem || owner instanceof TabItem;
  // What a question without picked panels is answered from.
  const panels = (
    isSection ? sources.filter((source) => source.sections.some(({ object }) => object === owner)) : sources
  ).map(toControlsPanel);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const questions = saved.map((question) => {
    // Panels removed since they were picked are left out. With none left, the question is answered from `panels`.
    const picked = (question.sources ?? []).flatMap(({ panelId }) => {
      const source = byKey.get(getVizPanelKeyForPanelId(panelId));
      return source ? [toControlsPanel(source)] : [];
    });
    return {
      text: question.text,
      title: question.title?.trim() || undefined,
      panels: picked.length ? picked : undefined,
    };
  });
  const shared = { dashboard: { uid: dashboard.state.uid ?? '', title: dashboard.state.title }, panels, questions };

  if (!isSection) {
    return { scope: 'dashboard', ...shared };
  }
  return {
    scope: owner instanceof TabItem ? 'tab' : 'row',
    sectionLabel: sceneGraph.interpolate(owner, owner.state.title ?? '').trim() || undefined,
    ...shared,
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'inline-flex',
      alignItems: 'center',
      verticalAlign: 'middle',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
    question: css({
      display: 'inline-flex',
      alignItems: 'center',
      // A plugin renders nothing where it can't ask, such as when its assistant isn't available.
      '&:empty': {
        display: 'none',
      },
    }),
  };
}
