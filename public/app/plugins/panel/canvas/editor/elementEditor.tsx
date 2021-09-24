import { cloneDeep, get as lodashGet } from 'lodash';
import { optionBuilder } from './options';
import { CanvasElementOptions, canvasElementRegistry, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

export interface CanvasEditorOptions {
  category: string[];
  getOptions: () => CanvasElementOptions;
  onChange: (v: CanvasElementOptions) => void;
}

export function getElementEditor(opts: CanvasEditorOptions): NestedPanelOptions<CanvasElementOptions> {
  return {
    category: opts.category,
    path: '--', // not used!

    // Note that canvas editor writes things to the scene!
    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(opts.getOptions(), path);
      },
      onChange: (path: string, value: any) => {
        let options = opts.getOptions();
        if (path === 'type' && value) {
          const layer = canvasElementRegistry.getIfExists(value);
          if (!layer) {
            console.warn('layer does not exist', value);
            return;
          }
          options = {
            ...options, // keep current options
            type: layer.id,
            config: cloneDeep(layer.defaultConfig ?? {}),
          };
        } else {
          options = setOptionImmutably(options, path, value);
        }
        opts.onChange(options);
      },
    }),

    // Dynamically fill the selected element
    build: (builder, context) => {
      const { options } = context;

      const layerTypes = canvasElementRegistry.selectOptions(
        options?.type // the selected value
          ? [options.type] // as an array
          : [DEFAULT_CANVAS_ELEMENT_CONFIG.type]
      );

      builder.addSelect({
        path: 'type',
        name: undefined as any, // required, but hide space
        settings: {
          options: layerTypes.options,
        },
      });

      // force clean layer configuration
      const layer = canvasElementRegistry.getIfExists(options?.type ?? DEFAULT_CANVAS_ELEMENT_CONFIG.type)!;
      const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultConfig, ...options?.config } };
      const ctx = { ...context, options: currentOptions };

      if (layer.registerOptionsUI) {
        layer.registerOptionsUI(builder, ctx);
      }

      optionBuilder.background(builder, ctx);
      optionBuilder.border(builder, ctx);
    },
  };
}
