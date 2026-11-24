import { t } from '@grafana/i18n';
import { type VizPanel } from '@grafana/scenes';

import { dashboardSceneGraph } from '../../utils/dashboardSceneGraph';
import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { getVizPanelKeyForPanelId } from '../../utils/utils-panels';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../layout-rows/RowItem';
import { RowsLayoutManager } from '../layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../types/DashboardLayoutManager';
import { isLayoutParent } from '../types/LayoutParent';

/**
 * Starting points for a report section. Each one inserts an ordinary row and Auto grid
 * settings; nothing later depends on which preset created them.
 */
export type ReportSectionPreset = 'section' | 'reading-flow' | 'side-by-side' | 'evidence-note';

/**
 * Adds a report section to the rows that own `layout`. A grid that already holds panels is
 * kept as it looks: it moves into a leading row with a hidden header, and the new section
 * follows it.
 */
export async function addReportSectionTo(
  layout: DashboardLayoutManager,
  preset: ReportSectionPreset
): Promise<RowItem> {
  const rows = getOrCreateRowsLayout(layout);
  const section = new RowItem({
    title: t('dashboard.report-section.new-title', 'New section'),
    headerStyle: 'report',
    layout: await createPresetLayout(rows, preset),
  });

  rows.addNewRow(section);
  return section;
}

function getOrCreateRowsLayout(layout: DashboardLayoutManager): RowsLayoutManager {
  if (layout instanceof RowsLayoutManager) {
    return layout;
  }

  if (layout instanceof TabsLayoutManager) {
    const currentTab = layout.getCurrentTab();
    if (!currentTab) {
      throw new Error('Could not find currently active tab');
    }
    return getOrCreateRowsLayout(currentTab.state.layout);
  }

  const layoutParent = layout.parent;
  if (!layoutParent || !isLayoutParent(layoutParent)) {
    throw new Error('Parent layout is not a LayoutParent');
  }

  const rows =
    layout.getVizPanels().length === 0
      ? new RowsLayoutManager({ rows: [] })
      : new RowsLayoutManager({
          rows: [
            new RowItem({
              title: t('dashboard.report-section.existing-content-title', 'Overview'),
              hideHeader: true,
              layout: layout.clone(),
            }),
          ],
        });

  layoutParent.switchLayout(rows);
  return rows;
}

async function createPresetLayout(
  rows: RowsLayoutManager,
  preset: ReportSectionPreset
): Promise<DashboardLayoutManager> {
  switch (preset) {
    case 'reading-flow':
      return new AutoGridLayoutManager({ maxColumnCount: 1 });
    case 'side-by-side':
      return new AutoGridLayoutManager({ maxColumnCount: 2 });
    case 'evidence-note': {
      const nextId = dashboardSceneGraph.getPanelIdGenerator(rows);
      const evidence = await getDefaultVizPanel();
      evidence.setState({ key: getVizPanelKeyForPanelId(nextId()) });
      const note = await createEditorialNote(getVizPanelKeyForPanelId(nextId()));

      const grid = new AutoGridLayoutManager({ maxColumnCount: 2, columnLayout: 'split-wide-first' });
      grid.state.layout.setState({
        children: [new AutoGridItem({ body: evidence }), new AutoGridItem({ body: note })],
      });
      return grid;
    }
    case 'section':
    default:
      return getDashboardSceneFor(rows).getDefaultLayout();
  }
}

async function createEditorialNote(key: string): Promise<VizPanel> {
  const note = await getDefaultVizPanel();
  note.setState({
    key,
    pluginId: 'text',
    title: t('dashboard.report-section.note-title', 'Note'),
    $data: undefined,
    options: {
      mode: 'markdown',
      textStyle: 'editorial',
      content: t(
        'dashboard.report-section.note-content',
        '**What this shows.** Write the reading a reviewer should take from the chart beside this note, and what it does not establish.'
      ),
    },
  });
  return note;
}
