import { css, cx } from '@emotion/css';
import { type PointerEvent, type ReactNode, useEffect, useReducer } from 'react';

import {
  type GrafanaTheme2,
  PluginExtensionPoints,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient, useFlagGrafanaDashboardQuestions } from '@grafana/runtime/internal';
import { sceneGraph, type SceneObject, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { getSourcePanels, type SourcePanel } from '../questions/sourcePanels';
import { type SceneQuestion } from '../questions/types';
import { getQuestionLabel, getQuestionSelectionId, isInControlsMenu } from '../questions/utils';
import { questionActions } from '../sidebar/questions/actions';
import { type QuestionsOwnerKind } from '../sidebar/questions/types';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getDashboardSceneFor, useDashboardState } from '../utils/utils';
import { getVizPanelKeyForPanelId } from '../utils/utils-panels';

import { type DashboardScene } from './DashboardScene';
import { isComposerMode, isViewingDashboard } from './dashboardModes';
import { EditActionsPopover } from './edit-actions-popover/EditActionsPopover';
import { QuestionEditActions } from './edit-actions-popover/QuestionEditActions';
import { type RowItem } from './layout-rows/RowItem';
import { type TabItem } from './layout-tabs/TabItem';
import { isRowItem, isTabItem } from './types/LayoutItemTypeGuards';
import { type DashboardSceneState, isFullDashboardEditing } from './types/dashboard';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

/** The dashboard, row, or tab whose saved questions the controls run. */
type ControlsOwner = DashboardScene | RowItem | TabItem;

type Props =
  | {
      /** Renders the controls in the dashboard controls bar, or with `inMenu`, in its controls menu. */
      dashboard: DashboardScene;
      /** Renders the questions placed in the controls menu, which the bar leaves out. */
      inMenu?: boolean;
      section?: never;
    }
  | {
      /** Renders the controls above the row's or tab's panels. */
      section: RowItem | TabItem;
      dashboard?: never;
      inMenu?: never;
    };

/** A saved question that viewers can run, with its position in the saved list. */
interface AskableQuestion {
  question: SceneQuestion;
  index: number;
}

/**
 * Renders the components that plugins add to the `DashboardControls` extension point. They render in the dashboard
 * controls bar, in the dashboard controls menu for the questions placed there, and above the panels of a row or tab.
 * Each component receives the questions saved on that dashboard, row, or tab, with the panels to answer them from.
 *
 * While the dashboard is edited, each question renders as its own control, rendered by the plugin with only that
 * question, which editors can select, duplicate, and delete like a link. Running it there keeps it selected, so editors
 * can change it and run it again. The controls menu has room for every question, so it renders each as its own control
 * for viewers too, instead of leaving the plugin to fold the ones past its limit into a menu within the menu.
 *
 * Renders nothing when `grafana.dashboardQuestions` is off, when no saved question has text (a question just added
 * in the editor has none yet), or while a panel is edited or a plan is previewed (see `getControlsMode`).
 *
 * Also renders nothing on a repeated row or tab after the first, or inside one. Repeat clones' panels have no stable
 * keys, so they're never passed on, and a later repeat's questions would be answered from the first repeat's panels.
 *
 * A row or tab has no controls menu, so it renders all its questions, whatever their placement.
 */
export function DashboardControlsExtensionPoint(props: Props) {
  const owner = props.section ?? props.dashboard;
  const inMenu = props.inMenu ?? false;
  const shown = useShownQuestions(owner, inMenu);

  return shown ? (
    <ControlsComponents
      owner={owner}
      questions={shown.questions}
      inBar={!props.section && !inMenu}
      inMenu={inMenu}
      isEditing={shown.isEditing}
    />
  ) : null;
}

/**
 * The saved questions that the controls of `owner` render, in its controls bar, above its panels, or in the controls
 * menu when `inMenu`. Undefined when they render nothing (see `DashboardControlsExtensionPoint`).
 */
function useShownQuestions(
  owner: ControlsOwner,
  inMenu: boolean
): { questions: AskableQuestion[]; isEditing: boolean } | undefined {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { questions } = owner.useState();
  const dashboardState = useDashboardState(owner);

  const mode = getControlsMode(dashboardState);

  if (!enabled || !mode || (mode === 'edit' && !savesQuestions(owner)) || isRepeatCloneOrChildOf(owner)) {
    return undefined;
  }

  const placedHere = getAskableQuestions(questions).filter(
    ({ question }) => getOwnerKind(owner) !== 'dashboard' || isInControlsMenu(question) === inMenu
  );
  return placedHere.length ? { questions: placedHere, isEditing: mode === 'edit' } : undefined;
}

/** Saved JSON isn't validated, so a question whose text isn't a string with content is left out. */
function getAskableQuestions(questions: SceneQuestion[] | undefined): AskableQuestion[] {
  return (questions ?? []).flatMap((question, index) =>
    typeof question?.text === 'string' && question.text.trim() !== '' ? [{ question, index }] : []
  );
}

interface ControlsComponentsProps {
  owner: ControlsOwner;
  questions: AskableQuestion[];
  /** In the dashboard controls bar. A row or tab lays its controls out in `SectionControlsRow` instead. */
  inBar: boolean;
  /** In the dashboard controls menu, where the questions stack. */
  inMenu: boolean;
  /** Renders one control per question, for editors to select and run. */
  isEditing: boolean;
}

function ControlsComponents({ owner, questions, inBar, inMenu, isEditing }: ControlsComponentsProps) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = useDashboardControlsComponents();
  useRerenderOnVariableChange(owner);

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(
    owner,
    questions.map(({ question }) => question)
  );

  return (
    <div
      className={cx(styles.container, inBar && styles.inBar, inMenu && styles.inMenu)}
      // While the dashboard is edited, keeps a click on a question from clearing the selection, so a question run
      // while it is edited stays open in the sidebar.
      {...(isEditing && { onPointerDown: stopPropagation, onPointerUp: stopPropagation })}
    >
      {isEditing || inMenu
        ? context.questions.map((question, i) => {
            const controls = components.map((Component) => (
              <Component key={Component.meta.id} {...context} questions={[question]} />
            ));
            return isEditing ? (
              <EditableQuestion key={questions[i].index} owner={owner} saved={questions[i]}>
                {controls}
              </EditableQuestion>
            ) : (
              <div key={questions[i].index} className={styles.question}>
                {controls}
              </div>
            );
          })
        : components.map((Component) => <Component key={Component.meta.id} {...context} />)}
    </div>
  );
}

const stopPropagation = (event: PointerEvent) => event.stopPropagation();

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
        openEditQuestionPane(owner, ownerKind, index, true);
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

/** The context interpolates panel, row, and tab titles, so a variable change can change it. */
function useRerenderOnVariableChange(owner: ControlsOwner) {
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const subscription = getDashboardSceneFor(owner).subscribeToEvent(SceneVariableValueChangedEvent, rerender);
    return () => subscription.unsubscribe();
  }, [owner]);
}

/**
 * How the controls show: as viewers see them, or one control per question while the dashboard is edited. Composer
 * hides the edit surfaces, so over Viewing or Editing they show as viewers see them. Undefined while a panel is
 * edited, or a plan is previewed with placeholder panels that have no queries.
 */
function getControlsMode(state: DashboardSceneState): 'view' | 'edit' | undefined {
  if (state.editPanel || state.planning) {
    return undefined;
  }
  if (isViewingDashboard(state) || isComposerMode(state)) {
    return 'view';
  }
  return isFullDashboardEditing(state) ? 'edit' : undefined;
}

function getOwnerKind(owner: ControlsOwner): QuestionsOwnerKind {
  if (isRowItem(owner)) {
    return 'row';
  }
  return isTabItem(owner) ? 'tab' : 'dashboard';
}

/** Whether the dashboard saves questions: a v1 save drops them, and turns rows and tabs into v1 rows. */
function savesQuestions(object: SceneObject): boolean {
  return getDashboardSceneFor(object).isV2();
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
function useQuestionsEnabled(): boolean {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { components } = useDashboardControlsComponents();
  return enabled && components.length > 0;
}

/** Whether editors can add and change questions on the dashboard `object` is on (see `useQuestionsEnabled`). */
export function useCanEditQuestions(object: SceneObject): boolean {
  return useQuestionsEnabled() && savesQuestions(object);
}

/**
 * How many questions the dashboard controls menu has to show: those placed there that its controls render. The menu
 * button counts them with its other controls, and has no menu to open without any.
 */
export function useControlsMenuQuestionCount(dashboard: DashboardScene): number {
  const shown = useShownQuestions(dashboard, true);
  const { components, isLoading } = useDashboardControlsComponents();
  return shown && !isLoading && components.length > 0 ? shown.questions.length : 0;
}

/**
 * Whether the dashboard places questions in its controls menu, for where a hook can't be used. Unlike
 * `useControlsMenuQuestionCount`, it doesn't know whether a plugin adds a control to run them, nor whether the
 * dashboard is viewed or edited, so it can say yes where the menu then has nothing to show.
 */
export function hasQuestionsInControlsMenu(dashboard: DashboardScene): boolean {
  return (
    getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDashboardQuestions, false) &&
    savesQuestions(dashboard) &&
    getAskableQuestions(dashboard.state.questions).some(({ question }) => isInControlsMenu(question))
  );
}

function toControlsPanel({ key, title, panel }: SourcePanel): PluginExtensionDashboardControlsPanel {
  return { key, title: sceneGraph.interpolate(panel, title) };
}

function getControlsContext(owner: ControlsOwner, saved: SceneQuestion[]): PluginExtensionDashboardControlsContext {
  const dashboard = getDashboardSceneFor(owner);
  const sources = getSourcePanels(dashboard);
  const isSection = isRowItem(owner) || isTabItem(owner);
  // What a question without picked panels is answered from.
  const panels = (
    isSection ? sources.filter((source) => source.sections.some(({ object }) => object === owner)) : sources
  ).map(toControlsPanel);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const questions = saved.map((question) => {
    // Panels removed since they were picked are left out. With none left, the question is answered from `panels`.
    const sources = Array.isArray(question.sources) ? question.sources : [];
    const picked = sources.flatMap(({ panelId }) => {
      const source = byKey.get(getVizPanelKeyForPanelId(panelId));
      return source ? [toControlsPanel(source)] : [];
    });
    return {
      text: question.text,
      title: typeof question.title === 'string' ? question.title.trim() || undefined : undefined,
      panels: picked.length ? picked : undefined,
    };
  });
  const shared = { dashboard: { uid: dashboard.state.uid ?? '', title: dashboard.state.title }, panels, questions };

  if (!isSection) {
    return { scope: 'dashboard', ...shared };
  }
  return {
    scope: isTabItem(owner) ? 'tab' : 'row',
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
    }),
    inBar: css({
      marginBottom: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
    inMenu: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
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
