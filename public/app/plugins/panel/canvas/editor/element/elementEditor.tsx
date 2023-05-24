import { get as lodashGet } from 'lodash';

import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import {
  CanvasElementOptions,
  canvasElementRegistry,
  DEFAULT_CANVAS_ELEMENT_CONFIG,
  defaultElementItems,
} from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { getElementTypes } from '../../utils';
import { optionBuilder } from '../options';

import { PlacementEditor } from './PlacementEditor';

export interface CanvasEditorOptions {
  element: ElementState;
  scene: Scene;
  category?: string[];
}

export interface TreeViewEditorProps {
  scene: Scene;
  layer: FrameState;
  selected: ElementState[];
}

export function getElementEditor(opts: CanvasEditorOptions): NestedPanelOptions<CanvasElementOptions> {
  return {
    category: opts.category,
    path: '--', // not used!

    // Note that canvas editor writes things to the scene!
    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(opts.element.options, path);
      },
      onChange: (path: string, value: any) => {
        let options = opts.element.options;
        if (path === 'type' && value) {
          const layer = canvasElementRegistry.getIfExists(value);
          if (!layer) {
            console.warn('layer does not exist', value);
            return;
          }
          options = {
            ...options,
            ...layer.getNewOptions(options),
            type: layer.id,
          };
        } else {
          options = setOptionImmutably(options, path, value);
        }
        opts.element.onChange(options);
        opts.element.updateData(opts.scene.context);
      },
    }),

    // Dynamically fill the selected element
    build: (builder, context) => {
      const { options } = opts.element;
      const current = options?.type ? options.type : DEFAULT_CANVAS_ELEMENT_CONFIG.type;
      const layerTypes = getElementTypes(opts.scene.shouldShowAdvancedTypes, current).options;

      const isUnsupported =
        !opts.scene.shouldShowAdvancedTypes && !defaultElementItems.filter((item) => item.id === options?.type).length;

      builder.addSelect({
        path: 'type',
        name: undefined as any, // required, but hide space
        settings: {
          options: layerTypes,
        },
        description: isUnsupported
          ? 'Selected element type is not supported by current settings. Please enable advanced element types.'
          : '',
      });

      // force clean layer configuration
      const layer = canvasElementRegistry.getIfExists(options?.type ?? DEFAULT_CANVAS_ELEMENT_CONFIG.type)!;
      let currentOptions = options;
      if (!currentOptions) {
        currentOptions = {
          ...layer.getNewOptions(options),
          type: layer.id,
          name: `Element ${Date.now()}.${Math.floor(Math.random() * 100)}`,
        };
      }
      const ctx = { ...context, options: currentOptions };

      if (layer?.registerOptionsUI) {
        layer.registerOptionsUI(builder, ctx);
      }

      builder.addCustomEditor({
        category: ['Layout'],
        id: 'content',
        path: '__', // not used
        name: 'Quick placement',
        editor: PlacementEditor,
        settings: opts,
      });

      optionBuilder.addBackground(builder, ctx);
      optionBuilder.addBorder(builder, ctx);
    },
  };
}
