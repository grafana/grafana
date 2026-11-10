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

import { type DashboardScene } from './DashboardScene';
import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

type ControlsOwner = DashboardScene | RowItem | TabItem;

interface Props {
  /** The dashboard for the dashboard controls bar, or the row or tab whose controls these are. */
  owner: ControlsOwner;
}

/**
 * SPIKE: lets plugins add a control to the dashboard controls bar and to the controls of a row or tab. Each component
 * gets the questions saved on the dashboard, row, or tab, and a source reference the dashboard data API resolves to
 * the panels the control sits over. Renders nothing where no questions are saved, or with
 * `grafana.dashboardQuestions` off. Questions without text, such as one just added in the editor, are left out.
 */
export function DashboardControlsExtensionPoint({ owner }: Props) {
  const enabled = useFlagGrafanaDashboardQuestions();
  const { questions } = owner.useState();
  const askable = questions?.filter((question) => question.text.trim()) ?? [];

  if (!enabled || !askable.length) {
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
