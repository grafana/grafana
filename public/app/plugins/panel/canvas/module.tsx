import { FieldConfigProperty, PanelOptionsEditorBuilder, PanelPlugin } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { TooltipDisplayMode } from '@grafana/schema/dist/esm/common/common.gen';
import { FrameState } from 'app/features/canvas/runtime/frame';

import { CanvasPanel, InstanceState } from './CanvasPanel';
import { getConnectionEditor } from './editor/connectionEditor';
import { getElementEditor } from './editor/element/elementEditor';
import { getLayerEditor } from './editor/layer/layerEditor';
import { PanZoomHelp } from './editor/panZoomHelp';
import { canvasMigrationHandler } from './migrations';
import { Options } from './panelcfg.gen';

export const addStandardCanvasEditorOptions = (builder: PanelOptionsEditorBuilder<Options>) => {
  let category = [t('canvas.category-canvas', 'Canvas')];
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
    showIf: () => config.featureToggles.canvasPanelPanZoom,
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
    path: 'zoomToContent',
    name: 'Zoom to content',
    description: 'Automatically zoom to fit content',
    defaultValue: false,
    showIf: () => config.featureToggles.canvasPanelPanZoom,
  });

  category = [t('canvas.category-tooltip', 'Tooltip')];

  builder.addRadio({
    path: 'tooltip.mode',
    name: t('canvas.tooltip-options.name-tooltip-mode', 'Tooltip mode'),
    category,
    defaultValue: TooltipDisplayMode.Single,
    settings: {
      options: [
        {
          value: TooltipDisplayMode.Single,
          label: t('canvas.tooltip-options.tooltip-mode-options.label-enabled', 'Enabled'),
        },
        {
          value: TooltipDisplayMode.None,
          label: t('canvas.tooltip-options.tooltip-mode-options.label-disabled', 'Disabled'),
        },
      ],
    },
  });

  builder.addBooleanSwitch({
    path: 'tooltip.disableForOneClick',
    name: t('canvas.tooltip-options.label-disable-one-click', 'Disable for one-click elements'),
    category,
    defaultValue: false,
    showIf: (options) => options.tooltip?.mode !== TooltipDisplayMode.None,
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
