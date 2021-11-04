import { get as lodashGet } from 'lodash';
import { optionBuilder } from './options';
import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { InstanceState } from '../CanvasPanel';
import { LayerElementListEditor } from './LayerElementListEditor';

export function getLayerEditor(opts: InstanceState): NestedPanelOptions<InstanceState> {
  const { layer } = opts;
  const options = layer.options || { elements: [] };

  return {
    category: ['Layer'],
    path: '--', // not used!

    // Note that canvas editor writes things to the scene!
    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(options, path);
      },
      onChange: (path: string, value: any) => {
        if (path === 'type' && value) {
          console.warn('unable to change layer type');
          return;
        }
        const c = setOptionImmutably(options, path, value);
        layer.onChange(c);
      },
    }),

    // Dynamically fill the selected element
    build: (builder, context) => {
      builder.addCustomEditor({
        id: 'content',
        path: 'root',
        name: 'Elements',
        editor: LayerElementListEditor,
        settings: opts,
      });

      // // force clean layer configuration
      // const layer = canvasElementRegistry.getIfExists(options?.type ?? DEFAULT_CANVAS_ELEMENT_CONFIG.type)!;
      //const currentOptions = { ...options, type: layer.id, config: { ...layer.defaultConfig, ...options?.config } };
      const ctx = { ...context, options };

      // if (layer.registerOptionsUI) {
      //   layer.registerOptionsUI(builder, ctx);
      // }

      optionBuilder.addBackground(builder as any, ctx);
      optionBuilder.addBorder(builder as any, ctx);
    },
  };
}
