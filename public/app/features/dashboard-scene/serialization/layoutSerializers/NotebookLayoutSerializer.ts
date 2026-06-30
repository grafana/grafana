import { VizPanel } from '@grafana/scenes';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';

import { AutoGridItem } from '../../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../../scene/layout-auto-grid/AutoGridLayout';
import {
  AUTO_GRID_DEFAULT_COLUMN_WIDTH,
  AUTO_GRID_DEFAULT_ROW_HEIGHT,
  AutoGridLayoutManager,
  getAutoRowsTemplate,
  getTemplateColumnsTemplate,
} from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { type DashboardLayoutManager } from '../../scene/types/DashboardLayoutManager';
import { type PanelIdGenerator } from '../../utils/dashboardSceneGraph';

import { buildLibraryPanel, buildVizPanel } from './utils';

// SPIKE STUB (F1, notebook-sibling-poc): proves a NotebookLayout dispatches through
// transformSaveModelSchemaV2ToScene and renders into a DashboardScene. It delegates to the
// auto-grid manager (single column) instead of a real notebook layout. F7 replaces this whole
// file + registry entry with the real NotebookLayoutManager/serializer. Do NOT ship this in a PR.
const NOTEBOOK_MAX_COLUMN_COUNT = 1;

export function deserializeNotebookLayout(
  layout: DashboardV2Spec['layout'],
  elements: DashboardV2Spec['elements'],
  preload: boolean,
  panelIdGenerator?: PanelIdGenerator
): DashboardLayoutManager {
  if (layout.kind !== 'NotebookLayout') {
    throw new Error('Invalid layout kind');
  }

  const children: AutoGridItem[] = layout.spec.cells.map((item) => {
    const el = elements[item.spec.element.name];
    if (!el) {
      throw new Error(`Element ${item.spec.element.name} not found in dashboard elements`);
    }

    let body: VizPanel | undefined;
    if (el.kind === 'Panel') {
      body = buildVizPanel(el);
    }
    if (el.kind === 'LibraryPanel') {
      body = buildLibraryPanel(el);
    }

    if (el.kind === 'Cell') {
      body = new VizPanel({
        pluginId: 'text',
        title: '',
        key: item.spec.element.name,
        options: {
          mode: 'markdown',
          content: el.spec.content.kind === 'Markdown' ? el.spec.content.spec.text : el.spec.content.spec.code,
        },
      });
    }

    if (body === undefined) {
      throw new Error(`Element ${item.spec.element.name} has unsupported kind ${el.kind}`);
    }

    return new AutoGridItem({ key: item.spec.element.name, body });
  });

  return new AutoGridLayoutManager({
    maxColumnCount: NOTEBOOK_MAX_COLUMN_COUNT,
    layout: new AutoGridLayout({
      templateColumns: getTemplateColumnsTemplate(NOTEBOOK_MAX_COLUMN_COUNT, AUTO_GRID_DEFAULT_COLUMN_WIDTH),
      autoRows: getAutoRowsTemplate(AUTO_GRID_DEFAULT_ROW_HEIGHT, false),
      children,
    }),
  });
}
