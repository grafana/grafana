import { css } from '@emotion/css';

import { type GrafanaTheme2, PluginExtensionPoints, type PluginExtensionDashboardControlsContext } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { useFlagGrafanaDashboardQuestions } from '@grafana/runtime/internal';
import { sceneGraph } from '@grafana/scenes';
import { type Question } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { useStyles2 } from '@grafana/ui';

import { getQuestionSourceRefs } from '../data-service/questionSources';
import { sectionRef } from '../data-service/sections';
import { getSectionPath } from '../data-service/sources';
import { isRepeatCloneOrChildOf } from '../utils/clone';
import { useDashboardState } from '../utils/utils';

import { type DashboardScene } from './DashboardScene';
import { isViewingDashboard } from './dashboardModes';
import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';
import { type DashboardSceneState } from './types/dashboard';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

type ControlsOwner = DashboardScene | RowItem | TabItem;

interface Props {
  /** The dashboard for the dashboard controls bar, or the row or tab whose controls these are. */
  owner: ControlsOwner;
}

/**
 * SPIKE: lets plugins add a control to the dashboard controls bar and to the controls of a row or tab. Each component
 * gets the questions saved on the dashboard, row, or tab, and a source reference the dashboard data API resolves to
 * the panels the control sits over. Renders nothing where no questions are saved, with `grafana.dashboardQuestions`
 * off, or while the dashboard or a panel is edited or a plan is previewed (see `isShowingDashboard`). Questions without
 * text, such as one just added in the editor, are left out.
 *
 * Renders nothing on a repeated row or tab after the first, or inside one: the dashboard data API reads only the
 * first repeat's panels, so a later repeat's questions would be answered from the first repeat's data.
 */
export function DashboardControlsExtensionPoint({ owner }: Props) {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { questions } = owner.useState();
  const dashboardState = useDashboardState(owner);
  const askable = questions?.filter((question) => question.text.trim()) ?? [];

  if (!enabled || !askable.length || !isShowingDashboard(dashboardState) || isRepeatCloneOrChildOf(owner)) {
    return null;
  }

  return <ControlsComponents owner={owner} questions={askable} />;
}

function ControlsComponents({ owner, questions }: { owner: ControlsOwner; questions: Question[] }) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = useDashboardControlsComponents();

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(owner, questions);

  return (
    // Keeps a click on the control from selecting the row (see RowItemRenderer onPointerUp).
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className={styles.container}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      {components.map((Component) => (
        <Component key={Component.meta.id} {...context} />
      ))}
    </div>
  );
}

/**
 * Viewers ask about the dashboard as it is shown: not while it is edited, a panel is edited, or a plan is previewed
 * with placeholder panels that have no queries.
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

function getControlsContext(owner: ControlsOwner, saved: Question[]): PluginExtensionDashboardControlsContext {
  // Every panel on the dashboard, or in the row or tab: what a question without sources is answered from.
  const sourceRef = sectionRef(getSectionPath(owner));
  const questions = saved.map((question) => ({
    text: question.text,
    sourceRefs: getQuestionSourceRefs(question, sourceRef),
  }));

  if (!(owner instanceof RowItem || owner instanceof TabItem)) {
    return { scope: 'dashboard', sourceRef, questions };
  }
  return {
    scope: owner instanceof TabItem ? 'tab' : 'row',
    sourceRef,
    sectionLabel: sceneGraph.interpolate(owner, owner.state.title ?? '').trim() || undefined,
    questions,
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
  };
}
