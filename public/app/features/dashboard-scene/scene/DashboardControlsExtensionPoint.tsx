import { css } from '@emotion/css';

import { type GrafanaTheme2, PluginExtensionPoints, type PluginExtensionDashboardControlsContext } from '@grafana/data';
import { usePluginComponents } from '@grafana/runtime';
import { SceneGridRow, sceneGraph, type SceneObject } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ALL_PANELS_REF, sectionRef } from '../data-service/sections';

import { RowItem } from './layout-rows/RowItem';
import { TabItem } from './layout-tabs/TabItem';

const COMPONENTS_LIMIT_PER_PLUGIN = 1;

interface Props {
  /** The row or tab whose controls these are. The dashboard controls bar passes none. */
  section?: RowItem | TabItem;
}

/**
 * SPIKE: lets plugins add a control to the dashboard controls bar and to the controls of a row or tab. Each component
 * gets a source reference the dashboard data API resolves to the panels the control sits over.
 */
export function DashboardControlsExtensionPoint({ section }: Props) {
  const styles = useStyles2(getStyles);
  const { components, isLoading } = usePluginComponents<PluginExtensionDashboardControlsContext>({
    extensionPointId: PluginExtensionPoints.DashboardControls,
    limitPerPlugin: COMPONENTS_LIMIT_PER_PLUGIN,
  });

  if (isLoading || components.length === 0) {
    return null;
  }

  const context = getControlsContext(section);

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

function getControlsContext(section: RowItem | TabItem | undefined): PluginExtensionDashboardControlsContext {
  if (!section) {
    return { scope: 'dashboard', sourceRef: ALL_PANELS_REF };
  }
  return {
    scope: section instanceof TabItem ? 'tab' : 'row',
    sourceRef: sectionRef(getSectionPath(section)),
    sectionLabel: sceneGraph.interpolate(section, section.state.title ?? '').trim() || undefined,
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
