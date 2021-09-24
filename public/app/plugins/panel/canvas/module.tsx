import { PanelPlugin } from '@grafana/data';

import { CanvasPanel, lastLoadedScene } from './CanvasPanel';
import { PanelOptions } from './models.gen';
import { CanvasElementOptions } from 'app/features/canvas';
import { getElementEditor } from './editor/elementEditor';

export const plugin = new PanelPlugin<PanelOptions>(CanvasPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig()
  .setPanelOptions((builder, context) => {
    console.log('BUILD canvas editors', lastLoadedScene, context.options);

    builder.addBooleanSwitch({
      path: 'inlineEditing',
      name: 'Inline editing',
      description: 'Enable editing while the panel is in dashboard mode',
      defaultValue: true,
    });

    if (lastLoadedScene) {
      const selected = lastLoadedScene.getSelectedItem();
      if (selected) {
        const uid = selected.UID;
        builder.addNestedOptions(
          getElementEditor({
            category: ['Selected element'],
            getOptions: () => lastLoadedScene!.getElement(uid)!.options,
            onChange: (v: CanvasElementOptions) => {
              lastLoadedScene?.onChange(uid, v);
            },
          })
        );
      }
    }
  });
