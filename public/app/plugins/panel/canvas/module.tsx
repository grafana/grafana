import { FieldConfigProperty, PanelOptionsEditorBuilder, PanelPlugin } from '@grafana/data';
import { FrameState } from 'app/features/canvas/runtime/frame';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
import { canvasMigrationHandler } from './migrations';
import { PanelOptions } from './models.gen';

export const addStandardCanvasEditorOptions = (builder: PanelOptionsEditorBuilder<PanelOptions>) => {
  builder.addBooleanSwitch({
    path: 'inlineEditing',
    name: 'Inline editing',
    description: 'Enable editing the panel directly',
    defaultValue: true,
  });

  builder.addBooleanSwitch({
    path: 'showAdvancedTypes',
    name: 'Show advanced element types',
    description: '',
    defaultValue: false,
  });
};

export const plugin = new PanelPlugin<PanelOptions>(CanvasPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Mappings]: {
        settings: {
          icon: true,
        },
      },
    },
  })
  .setMigrationHandler(canvasMigrationHandler)
  .setPanelOptions((builder, context) => {
    const state: InstanceState = context.instanceState;

    addStandardCanvasEditorOptions(builder);

    if (state) {
      builder.addNestedOptions(getLayerEditor(state));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof FrameState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [`Selected element (${element.options.name})`],
              element,
              scene: state.scene,
            })
          );
        }
      }
    }
  });
