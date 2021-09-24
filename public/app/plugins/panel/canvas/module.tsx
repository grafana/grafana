import { PanelPlugin } from '@grafana/data';

import { CanvasPanel, lastLoadedScene } from './CanvasPanel';
import { PanelOptions } from './models.gen';
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
        builder.addNestedOptions(
          getElementEditor({
            category: ['Selected element'],
            scene: lastLoadedScene,
            element: selected,
          })
        );
      }
    }

    // builder.addCustomEditor({
    //   category: ['Selected Element'],
    //   id: 'root',
    //   path: 'root', // multiple elements may edit root!
    //   name: 'Selected Element',
    //   editor: SelectedElementEditor,
    //   defaultValue: defaultPanelOptions.root,
    // });
  });
