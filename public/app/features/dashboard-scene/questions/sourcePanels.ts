import { getPanelPluginMetasMapSync, type PanelPluginMetas } from '@grafana/runtime/internal';
import { SceneGridRow, sceneGraph, type SceneObject, type VizPanel } from '@grafana/scenes';

import { RowItem } from '../scene/layout-rows/RowItem';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { type DashboardSceneLike } from '../scene/types/dashboard';
import { isRepeatCloneOrChildOf } from '../utils/clone';

export interface SourceSection {
  kind: 'tab' | 'row';
  /** The saved title, uninterpolated. */
  title: string;
  object: TabItem | RowItem | SceneGridRow;
}

export interface SourcePanel {
  key: string;
  title: string;
  panel: VizPanel;
  /** Tabs and rows the panel sits in, outermost first. */
  sections: SourceSection[];
}

/** Reading plugin metas copies every panel plugin's meta, and a plugin's meta doesn't change while Grafana runs. */
const skipsDataQueryByPluginId = new Map<string, boolean>();

/**
 * Panels a question can be answered from, in layout order: panels with queries. Repeat clones are excluded because
 * their keys are not stable across loads, and so are panels whose plugin skips data queries, because a query runner
 * left by the editor is not data the panel shows.
 */
export function getSourcePanels(dashboard: DashboardSceneLike): SourcePanel[] {
  let metas: PanelPluginMetas | undefined;
  // Panels in other tabs or collapsed rows may not have loaded their plugin yet.
  const skipsDataQuery = (panel: VizPanel) => {
    const plugin = panel.getPlugin();
    if (plugin) {
      return Boolean(plugin.meta.skipDataQuery);
    }
    const { pluginId } = panel.state;
    let skips = skipsDataQueryByPluginId.get(pluginId);
    if (skips === undefined) {
      metas ??= getPanelPluginMetasMapSync();
      const meta = metas[pluginId];
      skips = Boolean(meta?.skipDataQuery);
      if (meta) {
        skipsDataQueryByPluginId.set(pluginId, skips);
      }
    }
    return skips;
  };

  const sources: SourcePanel[] = [];
  for (const panel of dashboard.state.body.getVizPanels()) {
    const { key, $data, title } = panel.state;
    if (!key || !$data || skipsDataQuery(panel) || isRepeatCloneOrChildOf(panel)) {
      continue;
    }
    sources.push({ key, title: title || key, panel, sections: getSections(panel) });
  }
  return sources;
}

function getSections(panel: VizPanel): SourceSection[] {
  const sections: SourceSection[] = [];
  for (let parent: SceneObject | undefined = panel.parent; parent; parent = parent.parent) {
    if (parent instanceof TabItem) {
      sections.unshift({ kind: 'tab', title: parent.state.title ?? '', object: parent });
    } else if (parent instanceof RowItem || parent instanceof SceneGridRow) {
      sections.unshift({ kind: 'row', title: parent.state.title ?? '', object: parent });
    }
  }
  return sections;
}

/** The section's title as the viewer sees it; empty when it has none. */
export function getSectionLabel(section: SourceSection): string {
  return sceneGraph.interpolate(section.object, section.title).trim();
}
