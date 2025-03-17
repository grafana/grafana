import { capitalize } from 'lodash';

import { FieldType } from '@grafana/data';
import { PanelOptionsSupplier } from '@grafana/data/src/panel/PanelPlugin';
import { ConnectionDirection } from 'app/features/canvas/element';
import { SVGElements } from 'app/features/canvas/runtime/element';
import { ColorDimensionEditor, ResourceDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';
import { BackgroundSizeEditor } from 'app/features/dimensions/editors/BackgroundSizeEditor';

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
    const category = getCategoryName('Background', context.options?.type);
    builder
      .addCustomEditor({
        category,
        id: 'background.color',
        path: 'background.color',
        name: 'Color',
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
        name: 'Image',
        editor: ResourceDimensionEditor,
        settings: {
          resourceType: 'image',
        },
      })
      .addCustomEditor({
        category,
        id: 'background.size',
        path: 'background.size',
        name: 'Image size',
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
    const category = getCategoryName('Border', context.options?.type);
    builder.addSliderInput({
      category,
      path: 'border.width',
      name: 'Width',
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
        name: 'Color',
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
      name: 'Radius',
      defaultValue: 0,
      settings: {
        min: 0,
        max: 60,
      },
    });
  },

  addColor: (builder, context) => {
    const category = ['Color'];
    builder.addCustomEditor({
      category,
      id: 'color',
      path: 'color',
      name: 'Color',
      editor: ColorDimensionEditor,
      settings: {},
      defaultValue: {
        // Configured values
        fixed: '',
      },
    });
  },

  addSize: (builder, context) => {
    const category = ['Size'];
    builder.addCustomEditor({
      category,
      id: 'size',
      path: 'size',
      name: 'Size',
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
    const category = ['Radius'];
    builder.addCustomEditor({
      category,
      id: 'radius',
      path: 'radius',
      name: 'Radius',
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
    const category = ['Arrow Direction'];
    builder.addRadio({
      category,
      path: 'direction',
      name: 'Direction',
      settings: {
        options: [
          { value: undefined, label: capitalize(ConnectionDirection.Forward) },
          { value: ConnectionDirection.Reverse, label: capitalize(ConnectionDirection.Reverse) },
          { value: ConnectionDirection.Both, label: capitalize(ConnectionDirection.Both) },
          { value: ConnectionDirection.None, label: capitalize(ConnectionDirection.None) },
        ],
      },
      defaultValue: ConnectionDirection.Forward,
    });
  },

  addLineStyle: (builder, context) => {
    const category = ['Line style'];
    builder.addCustomEditor({
      category,
      id: 'lineStyle',
      path: 'lineStyle',
      name: 'Line style',
      editor: LineStyleEditor,
      settings: {},
      defaultValue: { value: LineStyle.Solid, label: 'Solid' },
    });
  },

  addDataLinks: (builder, context) => {
    builder.addCustomEditor({
      category: ['Data links and actions'],
      id: 'dataLinks',
      path: 'links',
      name: 'Links',
      editor: DataLinksEditor,
      settings: context.options,
    });
  },

  addActions: (builder, context) => {
    builder.addCustomEditor({
      category: ['Data links and actions'],
      id: 'actions',
      path: 'actions',
      name: 'Actions',
      editor: ActionsEditor,
      settings: context.options,
    });
  },
};
