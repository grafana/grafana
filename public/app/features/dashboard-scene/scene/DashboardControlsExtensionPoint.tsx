import { css, cx } from '@emotion/css';
import { type PointerEvent, type ReactNode, useEffect, useReducer } from 'react';

import {
  type GrafanaTheme2,
  PluginExtensionPoints,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useFlagGrafanaDashboardQuestions } from '@grafana/runtime/internal';
import { sceneGraph, type SceneObject, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { useElementSelection, useStyles2 } from '@grafana/ui';

import { getSourcePanels, type SourcePanel } from '../prompts/sourcePanels';
import { type ScenePrompt } from '../prompts/types';
import { getPromptLabel, getPromptSelectionId } from '../prompts/utils';
import { promptActions } from '../sidebar/prompts/actions';
import { type PromptsOwnerKind } from '../sidebar/prompts/types';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getDashboardSceneFor, useDashboardState } from '../utils/utils';
import { getVizPanelKeyForPanelId } from '../utils/utils-panels';

import { type DashboardScene } from './DashboardScene';
import { isViewingDashboard } from './dashboardModes';
import { EditActionsPopover } from './edit-actions-popover/EditActionsPopover';
import { PromptEditActions } from './edit-actions-popover/PromptEditActions';
import { type RowItem } from './layout-rows/RowItem';
import { type TabItem } from './layout-tabs/TabItem';
import { isRowItem, isTabItem } from './types/LayoutItemTypeGuards';
import { type DashboardSceneState, isFullDashboardEditing } from './types/dashboard';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

/** The dashboard, row, or tab whose saved prompts the controls run. */
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

/** A saved prompt that viewers can run, with its position in the saved list. */
interface AskablePrompt {
  prompt: ScenePrompt;
  index: number;
}

/**
 * Renders the components that plugins add to the `DashboardControls` extension point. They render in the dashboard
 * controls bar and above the panels of a row or tab. Each component receives the prompts saved on that dashboard,
 * row, or tab, with the panels to answer them from.
 *
 * While the dashboard is edited, each prompt renders as its own control, rendered by the plugin with only that
 * prompt, which editors can select, duplicate, and delete like a link. Running it there keeps it selected, so editors
 * can change it and run it again.
 *
 * Renders nothing when `grafana.dashboardQuestions` is off, when no saved prompt has text (a prompt just added
 * in the editor has none yet), or while the dashboard is neither viewed nor edited (see `getControlsMode`).
 *
 * Also renders nothing on a repeated row or tab after the first, or inside one. Repeat clones' panels have no stable
 * keys, so they're never passed on, and a later repeat's prompts would be answered from the first repeat's panels.
 */
export function DashboardControlsExtensionPoint(props: Props) {
  const owner = props.section ?? props.dashboard;
  const enabled = useFlagGrafanaDashboardQuestions();
  const { prompts } = owner.useState();
  const dashboardState = useDashboardState(owner);

  const mode = getControlsMode(dashboardState);

  if (!enabled || !mode || (mode === 'edit' && !savesPrompts(owner)) || isRepeatCloneOrChildOf(owner)) {
    return null;
  }

  const askable = getAskablePrompts(prompts);
  return askable.length ? (
    <ControlsComponents owner={owner} prompts={askable} inBar={!props.section} isEditing={mode === 'edit'} />
  ) : null;
}

/** Saved JSON isn't validated, so a prompt whose text isn't a string with content is left out. */
function getAskablePrompts(prompts: ScenePrompt[] | undefined): AskablePrompt[] {
  return (prompts ?? []).flatMap((prompt, index) =>
    typeof prompt?.text === 'string' && prompt.text.trim() !== '' ? [{ prompt, index }] : []
  );
}

interface ControlsComponentsProps {
  owner: ControlsOwner;
  prompts: AskablePrompt[];
  /** In the dashboard controls bar. A row or tab lays its controls out in `SectionControlsRow` instead. */
  inBar: boolean;
  /** Renders one control per prompt, for editors to select and run. */
  isEditing: boolean;
}

function ControlsComponents({ owner, prompts, inBar, isEditing }: ControlsComponentsProps) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = useDashboardControlsComponents();
  useRerenderOnVariableChange(owner);

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(
    owner,
    prompts.map(({ prompt }) => prompt)
  );

  return (
    <div
      className={cx(styles.container, inBar && styles.inBar)}
      // While the dashboard is edited, keeps a click on a prompt from clearing the selection, so a prompt run
      // while it is edited stays open in the sidebar.
      {...(isEditing && { onPointerDown: stopPropagation, onPointerUp: stopPropagation })}
    >
      {isEditing
        ? context.questions.map((question, i) => (
            <EditablePrompt key={prompts[i].index} owner={owner} saved={prompts[i]}>
              {components.map((Component) => (
                <Component key={Component.meta.id} {...context} questions={[question]} />
              ))}
            </EditablePrompt>
          ))
        : components.map((Component) => <Component key={Component.meta.id} {...context} />)}
    </div>
  );
}

const stopPropagation = (event: PointerEvent) => event.stopPropagation();

// The edit pane loads on first use, like the add flows in AddControlsButton.
const loadPromptEdit = () => import(/* webpackChunkName: "dashboard-add-controls" */ '../sidebar/prompts/PromptEdit');

/** A prompt's control while the dashboard is edited: selectable, with the actions links and variables have. */
function EditablePrompt({
  owner,
  saved: { prompt, index },
  children,
}: {
  owner: ControlsOwner;
  saved: AskablePrompt;
  children: ReactNode;
}) {
  const styles = useStyles2(getStyles);
  const ownerKind = getOwnerKind(owner);
  const { isSelected, isSelectable } = useElementSelection(getPromptSelectionId(owner, ownerKind, index));
  const { sidebar } = getDashboardSceneFor(owner).state;

  const onEdit = () =>
    sidebar.runPaneRequest(async (signal) => {
      const { openEditPromptPane } = await loadPromptEdit();
      if (!signal.aborted) {
        openEditPromptPane(owner, ownerKind, index);
      }
    });

  const onDuplicate = () =>
    sidebar.runPaneRequest(async (signal) => {
      const { duplicatePrompt } = await loadPromptEdit();
      if (!signal.aborted) {
        duplicatePrompt(owner, ownerKind, index);
      }
    });

  const onDelete = () => {
    promptActions.remove({ owner, index });
    // The sidebar would show whichever prompt moved into this one's place.
    if (isSelected) {
      sidebar.selectObject(owner);
    }
  };

  return (
    <EditActionsPopover
      content={
        <PromptEditActions
          name={getPromptLabel(prompt)}
          onClickEdit={onEdit}
          onClickDuplicate={onDuplicate}
          onClickDelete={onDelete}
        />
      }
    >
      <div
        className={cx(
          styles.prompt,
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
 * How the controls show: as viewers see them, or one control per prompt while the dashboard is edited. Undefined
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

function getOwnerKind(owner: ControlsOwner): PromptsOwnerKind {
  if (isRowItem(owner)) {
    return 'row';
  }
  return isTabItem(owner) ? 'tab' : 'dashboard';
}

/** Whether the dashboard saves prompts: a v1 save drops them, and turns rows and tabs into v1 rows. */
function savesPrompts(object: SceneObject): boolean {
  return getDashboardSceneFor(object).isV2();
}

function useDashboardControlsComponents() {
  return usePluginComponents<PluginExtensionDashboardControlsContext>({
    extensionPointId: PluginExtensionPoints.DashboardControls,
    limitPerPlugin: COMPONENTS_LIMIT_PER_PLUGIN,
  });
}

/**
 * Whether editors can save prompts: `grafana.dashboardQuestions` is on and a plugin adds a control
 * that offers them.
 */
function usePromptsEnabled(): boolean {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { components } = useDashboardControlsComponents();
  return enabled && components.length > 0;
}

/** Whether editors can add and change prompts on the dashboard `object` is on (see `usePromptsEnabled`). */
export function useCanEditPrompts(object: SceneObject): boolean {
  return usePromptsEnabled() && savesPrompts(object);
}

function toControlsPanel({ key, title, panel }: SourcePanel): PluginExtensionDashboardControlsPanel {
  return { key, title: sceneGraph.interpolate(panel, title) };
}

function getControlsContext(owner: ControlsOwner, saved: ScenePrompt[]): PluginExtensionDashboardControlsContext {
  const dashboard = getDashboardSceneFor(owner);
  const sources = getSourcePanels(dashboard);
  const isSection = isRowItem(owner) || isTabItem(owner);
  // What a prompt without picked panels is answered from.
  const panels = (
    isSection ? sources.filter((source) => source.sections.some(({ object }) => object === owner)) : sources
  ).map(toControlsPanel);
  const byKey = new Map(sources.map((source) => [source.key, source]));
  const questions = saved.map((prompt) => {
    // Panels removed since they were picked are left out. With none left, the prompt is answered from `panels`.
    const sources = Array.isArray(prompt.sources) ? prompt.sources : [];
    const picked = sources.flatMap(({ panelId }) => {
      const source = byKey.get(getVizPanelKeyForPanelId(panelId));
      return source ? [toControlsPanel(source)] : [];
    });
    return {
      text: prompt.text,
      title: typeof prompt.title === 'string' ? prompt.title.trim() || undefined : undefined,
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
    prompt: css({
      display: 'inline-flex',
      alignItems: 'center',
      // A plugin renders nothing where it can't ask, such as when its assistant isn't available.
      '&:empty': {
        display: 'none',
      },
    }),
  };
}
