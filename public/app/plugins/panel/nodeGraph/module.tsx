import { FieldConfigProperty, PanelPlugin } from '@grafana/data';

import { NodeGraphPanel } from './NodeGraphPanel';
import { ArcOptionsEditor } from './editor/ArcOptionsEditor';
import { LayoutAlgorithm, Options as NodeGraphOptions } from './panelcfg.gen';
import { NodeGraphSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<NodeGraphOptions>(NodeGraphPanel)
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Links),
  })
  .setPanelOptions((builder, context) => {
    builder.addSelect({
      name: 'Zoom mode',
      path: 'zoomMode',
      defaultValue: 'cooperative',
      settings: {
        options: [
          { value: 'cooperative', label: 'Cooperative', description: 'Lets you scroll the page normally' },
          { value: 'greedy', label: 'Greedy', description: 'Reacts to all zoom gestures' },
        ],
      },
    });
    builder.addSelect({
      name: 'Layout algorithm',
      path: 'layoutAlgorithm',
      defaultValue: LayoutAlgorithm.Layered,
      settings: {
        options: [
          { label: 'Layered', value: LayoutAlgorithm.Layered, description: 'Use a layered layout' },
          { label: 'Force', value: LayoutAlgorithm.Force, description: 'Use a force-directed layout' },
          { label: 'Grid', value: LayoutAlgorithm.Grid, description: 'Use a grid layout' },
        ],
      },
    });
    builder.addNestedOptions({
      category: ['Nodes'],
      path: 'nodes',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
        builder.addCustomEditor({
          name: 'Arc sections',
          path: 'arcs',
          id: 'arcs',
          editor: ArcOptionsEditor,
        });
      },
    });
    builder.addNestedOptions({
      category: ['Edges'],
      path: 'edges',
      build: (builder) => {
        builder.addUnitPicker({
          name: 'Main stat unit',
          path: 'mainStatUnit',
        });
        builder.addUnitPicker({
          name: 'Secondary stat unit',
          path: 'secondaryStatUnit',
        });
      },
    });
  })
  .setSuggestionsSupplier(new NodeGraphSuggestionsSupplier());
