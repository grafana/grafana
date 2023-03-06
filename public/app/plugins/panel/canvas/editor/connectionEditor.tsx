import { get as lodashGet } from 'lodash';

import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { CanvasConnection, CanvasConnectionOptions } from 'app/features/canvas';
import { Scene } from 'app/features/canvas/runtime/scene';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { optionBuilder } from './options';

export interface CanvasConnectionEditorOptions {
  connection: CanvasConnection;
  scene: Scene;
  category?: string[];
}

export function getConnectionEditor(opts: CanvasConnectionEditorOptions): NestedPanelOptions<CanvasConnectionOptions> {
  return {
    category: opts.category,
    path: '--', // not used!

    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(opts.connection.options, path);
      },
      onChange: (path: string, value: any) => {
        let options = opts.connection.options;
        options = setOptionImmutably(options, path, value);

        opts.scene.connections.onChange(options, opts.connection);
      },
    }),

    // Dynamically fill the selected element
    build: (builder, context) => {
      const { options } = opts.connection;
      const ctx = { ...context, options: options };
      optionBuilder.addColor(builder, ctx);
    },
  };
}
