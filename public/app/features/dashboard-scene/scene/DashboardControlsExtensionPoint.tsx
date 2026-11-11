import { css, cx } from '@emotion/css';
import { useEffect, useReducer } from 'react';

import {
  type GrafanaTheme2,
  PluginExtensionPoints,
  type PluginExtensionDashboardControlsContext,
  type PluginExtensionDashboardControlsPanel,
} from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useFlagGrafanaDashboardQuestions } from '@grafana/runtime/internal';
import { sceneGraph, SceneVariableValueChangedEvent } from '@grafana/scenes';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { useStyles2 } from '@grafana/ui';

import { getSourcePanels, type SourcePanel } from '../questions/sourcePanels';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { getDashboardSceneFor, useDashboardState } from '../utils/utils';
import { getVizPanelKeyForPanelId } from '../utils/utils-panels';

import { type DashboardScene } from './DashboardScene';
import { isViewingDashboard } from './dashboardModes';
import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';
import { type DashboardSceneState } from './types/dashboard';

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

/**
 * Renders the components that plugins add to the `DashboardControls` extension point. They render in the dashboard
 * controls bar and above the panels of a row or tab. Each component receives the questions saved on that dashboard,
 * row, or tab, with the panels to answer them from.
 *
 * Renders nothing when `grafana.dashboardQuestions` is off, when no saved question has text (a question just added
 * in the editor has none yet), or while the dashboard isn't shown as viewers see it (see `isShowingDashboard`).
 *
 * Also renders nothing on a repeated row or tab after the first, or inside one. Repeat clones' panels have no stable
 * keys, so they're never passed on, and a later repeat's questions would be answered from the first repeat's panels.
 */
export function DashboardControlsExtensionPoint(props: Props) {
  const owner = props.section ?? props.dashboard;
  const enabled = useFlagGrafanaDashboardQuestions();
  const { questions } = owner.useState();
  const dashboardState = useDashboardState(owner);

  if (!enabled || !isShowingDashboard(dashboardState) || isRepeatCloneOrChildOf(owner)) {
    return null;
  }

  const askable = getAskableQuestions(questions);
  return askable.length ? <ControlsComponents owner={owner} questions={askable} inBar={!props.section} /> : null;
}

/** Saved JSON isn't validated, so a question whose text isn't a string with content is left out. */
function getAskableQuestions(questions: Question[] | undefined): Question[] {
  return (questions ?? []).filter((question) => typeof question?.text === 'string' && question.text.trim() !== '');
}

interface ControlsComponentsProps {
  owner: ControlsOwner;
  questions: Question[];
  /** In the dashboard controls bar. A row or tab lays its controls out in `SectionControlsRow` instead. */
  inBar: boolean;
}

function ControlsComponents({ owner, questions, inBar }: ControlsComponentsProps) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = useDashboardControlsComponents();
  useRerenderOnVariableChange(owner);

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(owner, questions);

  return (
    <div className={cx(styles.container, inBar && styles.inBar)}>
      {components.map((Component) => (
        <Component key={Component.meta.id} {...context} />
      ))}
    </div>
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
 * Whether the dashboard is shown as viewers see it, which is what they ask about. It isn't while the dashboard or a
 * panel is edited, or while a plan is previewed with placeholder panels that have no queries.
 */
function isShowingDashboard(state: DashboardSceneState): boolean {
  return isViewingDashboard(state) && !state.editPanel && !state.planning;
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

function toControlsPanel({ key, title, panel }: SourcePanel): PluginExtensionDashboardControlsPanel {
  return { key, title: sceneGraph.interpolate(panel, title) };
}

function getControlsContext(owner: ControlsOwner, saved: Question[]): PluginExtensionDashboardControlsContext {
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
    const sources = Array.isArray(question.sources) ? question.sources : [];
    const picked = sources.flatMap(({ panelId }) => {
      const source = byKey.get(getVizPanelKeyForPanelId(panelId));
      return source ? [toControlsPanel(source)] : [];
    });
    return { text: question.text, panels: picked.length ? picked : undefined };
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
    }),
    inBar: css({
      marginBottom: theme.spacing(1),
      marginRight: theme.spacing(1),
    }),
  };
}
