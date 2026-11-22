import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FrameState } from 'app/features/canvas/runtime/frame';

import { CanvasPanel, type InstanceState } from './CanvasPanel';
import { getConnectionEditor } from './editor/connectionEditor';
import { getElementEditor } from './editor/element/elementEditor';
import { getLayerEditor } from './editor/layer/layerEditor';
import { addStandardCanvasEditorOptions } from './editor/standardOptions';
import { canvasMigrationHandler } from './migrations';
import { type Options } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options>(CanvasPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Mappings]: {
        settings: {
          icon: true,
        },
      },
      [FieldConfigProperty.Links]: {
        settings: {
          showOneClick: false,
        },
      },
      [FieldConfigProperty.Actions]: {
        settings: {
          showOneClick: false,
        },
      },
    },
  })
  .setMigrationHandler(canvasMigrationHandler, (panel) => {
    const pluginVersion = panel?.pluginVersion ?? '';
    return parseFloat(pluginVersion) <= 12.2;
  })
  .setPanelOptions((builder, context) => {
    const state: InstanceState = context.instanceState;

    addStandardCanvasEditorOptions(builder);

    if (state && state.scene) {
      builder.addNestedOptions(getLayerEditor(state));

      const selection = state.selected;
      const connectionSelection = state.selectedConnection;

      if (selection?.length === 1) {
        const element = selection[0];
        if (!(element instanceof FrameState)) {
          builder.addNestedOptions(
            getElementEditor({
              category: [
                t('canvas.category-selected-element', 'Selected element ({{element}})', {
                  element: element.options.name,
                }),
              ],
              element,
              scene: state.scene,
            })
          );
        }
      }

      if (connectionSelection) {
        builder.addNestedOptions(
          getConnectionEditor({
            category: [t('canvas.category-selected-connection', 'Selected connection')],
            connection: connectionSelection,
            scene: state.scene,
          })
        );
      }
    }
  });
