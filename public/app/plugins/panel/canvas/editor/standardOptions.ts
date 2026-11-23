import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { TooltipDisplayMode } from '@grafana/schema';

import { type Options } from '../panelcfg.gen';

import { PanZoomHelp } from './panZoomHelp';

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
    showIf: () => getFeatureFlagClient().getBooleanValue(FlagKeys.CanvasPanelPanZoom, false),
  });
  builder.addCustomEditor({
    id: 'panZoomHelp',
    path: 'panZoomHelp',
    name: '',
    category,
    editor: PanZoomHelp,
    showIf: (opts) => getFeatureFlagClient().getBooleanValue(FlagKeys.CanvasPanelPanZoom, false) && opts.panZoom,
  });
  builder.addBooleanSwitch({
    path: 'zoomToContent',
    name: 'Zoom to content',
    description: 'Automatically zoom to fit content',
    defaultValue: false,
    showIf: () => getFeatureFlagClient().getBooleanValue(FlagKeys.CanvasPanelPanZoom, false),
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
