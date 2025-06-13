import { get as lodashGet } from 'lodash';

import { NestedPanelOptions, NestedValueAccess } from '@grafana/data/internal';
import { Scene } from 'app/features/canvas/runtime/scene';
import { setOptionImmutably } from 'app/features/dashboard/components/PanelEditor/utils';

import { CanvasConnection } from '../panelcfg.gen';
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
      // TODO: Fix this unknown (maybe a dimension supplier?)
      onChange: (path: string, value: unknown) => {
        let options = opts.connection.info;
        options = setOptionImmutably(options, path, value);
        opts.scene.connections.onChange(opts.connection, options);
      },
    }),

    build: (builder, context) => {
      const ctx = { ...context, options: opts.connection.info };
      optionBuilder.addColor(builder, ctx);
      optionBuilder.addSize(builder, ctx);
      optionBuilder.addRadius(builder, ctx);
      optionBuilder.addDirection(builder, ctx);
      optionBuilder.addLineStyle(builder, ctx);
    },
  };
}
