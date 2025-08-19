import { FieldType } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { ConnectionDirection } from 'app/features/canvas/element';
import { SVGElements } from 'app/features/canvas/runtime/element';
import { BackgroundSizeEditor } from 'app/features/dimensions/editors/BackgroundSizeEditor';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { ResourceDimensionEditor } from 'app/features/dimensions/editors/ResourceDimensionEditor';
import { ScaleDimensionEditor } from 'app/features/dimensions/editors/ScaleDimensionEditor';

import { CanvasConnection, CanvasElementOptions } from '../panelcfg.gen';
import { LineStyle } from '../types';

import { LineStyleEditor } from './LineStyleEditor';
import { ActionsEditor } from './element/ActionsEditor';
import { DataLinksEditor } from './element/DataLinksEditor';

interface OptionSuppliers {
  addBackground: PanelOptionsSupplier<CanvasElementOptions>;
  addBorder: PanelOptionsSupplier<CanvasElementOptions>;
  addDataLinks: PanelOptionsSupplier<CanvasElementOptions>;
  addActions: PanelOptionsSupplier<CanvasElementOptions>;
  addColor: PanelOptionsSupplier<CanvasConnection>;
  addSize: PanelOptionsSupplier<CanvasConnection>;
  addRadius: PanelOptionsSupplier<CanvasConnection>;
  addDirection: PanelOptionsSupplier<CanvasConnection>;
  addLineStyle: PanelOptionsSupplier<CanvasConnection>;
}

const getCategoryName = (str: string, type: string | undefined) => {
  if (type !== 'frame' && type !== undefined) {
    return [str + ` (${type})`];
  }
  return [str];
};

export const optionBuilder: OptionSuppliers = {
  addBackground: (builder, context) => {
    const category = getCategoryName(t('canvas.category-background', 'Background'), context.options?.type);
    builder
      .addCustomEditor({
        category,
        id: 'background.color',
        path: 'background.color',
        name: t('canvas.label-color', 'Color'),
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: '',
        },
      })
      .addCustomEditor({
        category,
        id: 'background.image',
        path: 'background.image',
        name: t('canvas.label-image', 'Image'),
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'image',
        },
      })
      .addCustomEditor({
        category,
        id: 'background.size',
        path: 'background.size',
        name: t('canvas.label-image-size', 'Image size'),
        editor: BackgroundSizeEditor,
        settings: {
          resourceType: 'image',
        },
        showIf: () => {
          // Do not show image size editor for SVG based elements
          // See https://github.com/grafana/grafana/issues/84843#issuecomment-2010921066 for additional context
          if (context.options?.type) {
            return !SVGElements.has(context.options.type);
          }

          return true;
        },
      });
  },

  addBorder: (builder, context) => {
    const category = getCategoryName(t('canvas.category-border', 'Border'), context.options?.type);
    builder.addSliderInput({
      category,
      path: 'border.width',
      name: t('canvas.label-width', 'Width'),
      defaultValue: 2,
      settings: {
        min: 0,
        max: 20,
      },
    });

    if (context.options?.border?.width) {
      builder.addCustomEditor({
        category,
        id: 'border.color',
        path: 'border.color',
        name: t('canvas.label-color', 'Color'),
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: '',
        },
      });
    }

    builder.addSliderInput({
      category,
      path: 'border.radius',
      name: t('canvas.label-radius', 'Radius'),
      defaultValue: 0,
      settings: {
        min: 0,
        max: 60,
      },
    });
  },

  addColor: (builder, context) => {
    const category = [t('canvas.category-color', 'Color')];
    builder.addCustomEditor({
      category,
      id: 'color',
      path: 'color',
      name: t('canvas.label-color', 'Color'),
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: {
        // Configured values
        fixed: '',
      },
    });
  },

  addSize: (builder, context) => {
    const category = [t('canvas.category-size', 'Size')];
    builder.addCustomEditor({
      category,
      id: 'size',
      path: 'size',
      name: t('canvas.label-size', 'Size'),
      editor: ScaleDimensionEditor,
      settings: {
        min: 1,
        max: 10,
      },
      defaultValue: {
        // Configured values
        fixed: 2,
        min: 1,
        max: 10,
      },
    });
  },

  addRadius: (builder, context) => {
    const category = [t('canvas.category-radius', 'Radius')];
    builder.addCustomEditor({
      category,
      id: 'radius',
      path: 'radius',
      name: t('canvas.label-radius', 'Radius'),
      editor: ScaleDimensionEditor,
      settings: {
        min: 0,
        max: 200,
        filteredFieldType: FieldType.number,
      },
      defaultValue: {
        // Configured values
        fixed: 0,
        min: 0,
        max: 100,
      },
    });
  },

  addDirection: (builder, context) => {
    const category = [t('canvas.category-arrow-direction', 'Arrow Direction')];
    builder.addRadio({
      category,
      path: 'direction',
      name: t('canvas.label-direction', 'Direction'),
      settings: {
        options: [
          { value: undefined, label: t('canvas.direction-options.label-forward', 'Forward') },
          { value: ConnectionDirection.Reverse, label: t('canvas.direction-options.label-reverse', 'Reverse') },
          { value: ConnectionDirection.Both, label: t('canvas.direction-options.label-both', 'Both') },
          { value: ConnectionDirection.None, label: t('canvas.direction-options.label-none', 'None') },
        ],
      },
      defaultValue: ConnectionDirection.Forward,
    });
  },

  addLineStyle: (builder, context) => {
    const category = [t('canvas.category-line-style', 'Line style')];
    builder.addCustomEditor({
      category,
      id: 'lineStyle',
      path: 'lineStyle',
      name: t('canvas.label-line-style', 'Line style'),
      editor: LineStyleEditor,
      settings: {},
      defaultValue: { value: LineStyle.Solid, label: t('canvas.line-style-options.label-solid', 'Solid') },
    });
  },

  addDataLinks: (builder, context) => {
    builder.addCustomEditor({
      category: [t('canvas.category-data-links', 'Data links and actions')],
      id: 'dataLinks',
      path: 'links',
      name: t('canvas.label-links', 'Links'),
      editor: DataLinksEditor,
      settings: context.options,
    });
  },

  addActions: (builder, context) => {
    builder.addCustomEditor({
      category: [t('canvas.category-data-links', 'Data links and actions')],
      id: 'actions',
      path: 'actions',
      name: t('canvas.label-actions', 'Actions'),
      editor: ActionsEditor,
      settings: context.options,
    });
  },
};
