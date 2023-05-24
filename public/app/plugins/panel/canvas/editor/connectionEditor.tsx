import { get as lodashGet } from 'lodash';

import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/src/utils/OptionsUIBuilders';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';
import { CanvasConnection } from 'app/features/visualization/canvas';
import { Scene } from 'app/features/visualization/canvas/runtime/scene';

import { ConnectionState } from '../types';

import { optionBuilder } from './options';

export interface CanvasConnectionEditorOptions {
  connection: ConnectionState;
  scene: Scene;
  category?: string[];
}

export function getConnectionEditor(opts: CanvasConnectionEditorOptions): NestedPanelOptions<CanvasConnection> {
  return {
    category: opts.category,
    path: '--', // not used!

    values: (parent: NestedValueAccess) => ({
      getValue: (path: string) => {
        return lodashGet(opts.connection.info, path);
      },
      // TODO: Fix this any (maybe a dimension supplier?)
      onChange: (path: string, value: any) => {
        console.log(value, typeof value);
        let options = opts.connection.info;
        options = setOptionImmutably(options, path, value);
        opts.scene.connections.onChange(opts.connection, options);
      },
    }),

    build: (builder, context) => {
      const ctx = { ...context, options: opts.connection.info };
      optionBuilder.addColor(builder, ctx);
      optionBuilder.addSize(builder, ctx);
    },
  };
}
