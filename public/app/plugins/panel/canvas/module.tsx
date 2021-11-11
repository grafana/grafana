import { PanelPlugin } from '@grafana/data';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { PanelOptions } from './models.gen';
import { getElementEditor } from './editor/elementEditor';
import { getLayerEditor } from './editor/layerEditor';
import { getElementsEditor } from './editor/elementsEditor';

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
      const selection = state.selected;
      if (selection?.length === 1) {
        builder.addNestedOptions(
          getElementEditor({
            category: [`Selected element (id: ${selection[0].UID})`], // changing the ID forces are reload
            element: selection[0],
            scene: state.scene,
          })
        );
      } else if (selection?.length > 1) {
        builder.addNestedOptions(
          getElementsEditor({
            category: [`Current selection`],
            scene: state.scene,
          })
        );
      }

      builder.addNestedOptions(getLayerEditor(state));
    }
  });
