import { FieldConfigProperty, PanelOptionsEditorBuilder, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { FrameState } from 'app/features/canvas/runtime/frame';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { getConnectionEditor } from './editor/connectionEditor';
import { getElementEditor } from './editor/element/elementEditor';
import { getLayerEditor } from './editor/layer/layerEditor';
import { PanZoomHelp } from './editor/panZoomHelp';
import { canvasMigrationHandler } from './migrations';
import { Options } from './panelcfg.gen';

export const addStandardCanvasEditorOptions = (builder: PanelOptionsEditorBuilder<Options>) => {
  const category = [t('canvas.category-canvas', 'Canvas')];
  builder.addBooleanSwitch({
    path: 'inlineEditing',
    name: t('canvas.name-inline-editing', 'Inline editing'),
    category,
    description: t('canvas.description-inline-editing', 'Enable editing the panel directly'),
    defaultValue: true,
  });

  builder.addBooleanSwitch({
    path: 'showAdvancedTypes',
    name: t('canvas.name-experimental-types', 'Experimental element types'),
    category,
    description: t('canvas.description-experimental-types', 'Enable selection of experimental element types'),
    defaultValue: true,
  });

  builder.addBooleanSwitch({
    path: 'panZoom',
    name: t('canvas.name-pan-zoom', 'Pan and zoom'),
    category,
    description: t('canvas.description-pan-zoom', 'Enable pan and zoom'),
    defaultValue: false,
    showIf: (opts) => config.featureToggles.canvasPanelPanZoom,
  });
  builder.addCustomEditor({
    id: 'panZoomHelp',
    path: 'panZoomHelp',
    name: '',
    category,
    editor: PanZoomHelp,
    showIf: (opts) => config.featureToggles.canvasPanelPanZoom && opts.panZoom,
  });
  builder.addBooleanSwitch({
    path: 'infinitePan',
    name: t('canvas.name-infinite-panning', 'Infinite panning'),
    category,
    description: t(
      'canvas.description-infinite-panning',
      'Enable infinite panning - useful for expansive canvases. Warning: this is an experimental feature and currently only works well with elements that are top / left constrained'
    ),
    defaultValue: false,
    showIf: (opts) => config.featureToggles.canvasPanelPanZoom && opts.panZoom,
  });
};

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
  .setMigrationHandler(canvasMigrationHandler)
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
