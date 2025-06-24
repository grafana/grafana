import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { LayoutAlgorithm, Options as NodeGraphOptions } from './panelcfg.gen';
import { NodeGraphSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<NodeGraphOptions>(NodeGraphPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
  })
  .setPanelOptions((builder, context) => {
    const category = [t('node-graph.category-node-graph', 'Node graph')];
    builder.addSelect({
      name: t('node-graph.name-zoom-mode', 'Zoom mode'),
      category,
      path: 'zoomMode',
      defaultValue: 'cooperative',
      settings: {
        options: [
          {
            value: 'cooperative',
            label: t('node-graph.zoom-mode-options.label-cooperative', 'Cooperative'),
            description: t('node-graph.zoom-mode-options.description-cooperative', 'Lets you scroll the page normally'),
          },
          {
            value: 'greedy',
            label: t('node-graph.zoom-mode-options.label-greedy', 'Greedy'),
            description: t('node-graph.zoom-mode-options.description-greedy', 'Reacts to all zoom gestures'),
          },
        ],
      },
    });
    builder.addSelect({
      name: t('node-graph.name-layout-algorithm', 'Layout algorithm'),
      category,
      path: 'layoutAlgorithm',
      defaultValue: LayoutAlgorithm.Layered,
      settings: {
        options: [
          {
            label: t('node-graph.layout-algorithm-options.label-layered', 'Layered'),
            value: LayoutAlgorithm.Layered,
            description: t('node-graph.layout-algorithm-options.description-layered', 'Use a layered layout'),
          },
          {
            label: t('node-graph.layout-algorithm-options.label-force', 'Force'),
            value: LayoutAlgorithm.Force,
            description: t('node-graph.layout-algorithm-options.description-force', 'Use a force-directed layout'),
          },
          {
            label: t('node-graph.layout-algorithm-options.label-grid', 'Grid'),
            value: LayoutAlgorithm.Grid,
            description: t('node-graph.layout-algorithm-options.description-grid', 'Use a grid layout'),
          },
        ],
      },
    });
    builder.addNestedOptions({
      category: [t('node-graph.category-nodes', 'Nodes')],
      path: 'nodes',
      build: (builder) => {
        builder.addUnitPicker({
          name: t('node-graph.name-main-stat-unit', 'Main stat unit'),
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: t('node-graph.name-secondary-stat-unit', 'Secondary stat unit'),
          path: 'secondaryStatUnit',
        });
        builder.addCustomEditor({
          name: t('node-graph.name-arc-sections', 'Arc sections'),
          path: 'arcs',
          id: 'arcs',
          editor: ArcOptionsEditor,
        });
      },
    });
    builder.addNestedOptions({
      category: [t('node-graph.category-edges', 'Edges')],
      path: 'edges',
      build: (builder) => {
        builder.addUnitPicker({
          name: t('node-graph.name-main-stat-unit', 'Main stat unit'),
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: t('node-graph.name-secondary-stat-unit', 'Secondary stat unit'),
          path: 'secondaryStatUnit',
        });
      },
    });
  })
  .setSuggestionsSupplier(new NodeGraphSuggestionsSupplier());
