import { css } from '@emotion/css';

import { type GrafanaTheme2, PluginExtensionPoints, type PluginExtensionDashboardControlsContext } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { SceneGridRow, sceneGraph, type SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ALL_PANELS_REF, sectionRef } from '../data-service/sections';

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
 * the panels the control sits over. Renders nothing where no questions are saved.
 */
export function DashboardControlsExtensionPoint({ owner }: Props) {
  const { questions } = owner.useState();

  if (!questions?.length) {
    return null;
  }

  return <ControlsComponents owner={owner} questions={questions} />;
}

function ControlsComponents({ owner, questions }: { owner: ControlsOwner; questions: string[] }) {
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

/** Whether a plugin adds a control that offers the saved questions, so editors ask for questions only when one does. */
export function useHasDashboardControlsComponents(): boolean {
  return useDashboardControlsComponents().components.length > 0;
}

function getControlsContext(owner: ControlsOwner, questions: string[]): PluginExtensionDashboardControlsContext {
  if (!(owner instanceof RowItem || owner instanceof TabItem)) {
    return { scope: 'dashboard', sourceRef: ALL_PANELS_REF, questions };
  }
  return {
    scope: owner instanceof TabItem ? 'tab' : 'row',
    sourceRef: sectionRef(getSectionPath(owner)),
    sectionLabel: sceneGraph.interpolate(owner, owner.state.title ?? '').trim() || undefined,
    questions,
  };
}

/** The saved titles of the section and the tabs and rows around it, outermost first, as the data API builds them. */
function getSectionPath(section: SceneObject): string[] {
  const path: string[] = [];
  for (let current: SceneObject | undefined = section; current; current = current.parent) {
    if (current instanceof TabItem || current instanceof RowItem || current instanceof SceneGridRow) {
      path.unshift(current.state.title ?? '');
    }
  }
  return path;
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
