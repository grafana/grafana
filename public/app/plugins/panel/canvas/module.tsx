import { PanelPlugin } from '@grafana/data';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { PanelOptions } from './models.gen';
import { getElementEditor } from './editor/elementEditor';

export const plugin = new PanelPlugin<PanelOptions>(CanvasPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig()
  .setPanelOptions((builder, context) => {
    const state: InstanceState = context.instanceState;

    builder.addBooleanSwitch({
      path: 'inlineEditing',
      name: 'Inline editing',
      description: 'Enable editing while the panel is in dashboard mode',
      defaultValue: true,
    });

    if (state?.selected) {
      builder.addNestedOptions(
        getElementEditor({
          category: ['Selected element'],
          element: state.selected,
          scene: state.scene,
        })
      );
    }
  });
