import { PanelPlugin } from '@grafana/data';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { PanelOptions } from './models.gen';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
import { GroupState } from 'app/features/canvas/runtime/group';

export const plugin = new PanelPlugin<PanelOptions>(CanvasPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig()
  .setPanelOptions((builder, context) => {
    const state: InstanceState = context.instanceState;

    builder.addBooleanSwitch({
      path: 'inlineEditing',
      name: 'Inline editing',
      description: 'Enable editing the panel directly',
      defaultValue: true,
    });

    if (state) {
      builder.addNestedOptions(getLayerEditor(state));

      const selection = state.selected;
      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof GroupState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [`Selected element (${element.options.name})`], // changing the ID forces reload
              element,
              scene: state.scene,
            })
          );
        }
      }
    }
  });
