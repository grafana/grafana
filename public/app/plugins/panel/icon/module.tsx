import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { CanvasElementOptions } from 'app/features/canvas';
import { IconConfig, iconItem } from 'app/features/canvas/elements/icon';

import { optionBuilder } from '../canvas/editor/options';

import { IconPanel } from './IconPanel';
import { defaultOptions, Options } from './models.gen';

export const plugin = new PanelPlugin<Options>(IconPanel)
  .setNoPadding() // extend to panel edges
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Mappings]: {
        settings: {
          icon: true,
        },
      },
    },
  })
  .setPanelOptions((builder) => {
    builder.addNestedOptions<CanvasElementOptions<IconConfig>>({
      category: ['Icon'],
      path: 'root',

      // Dynamically fill the selected element
      build: (builder, ctx) => {
        iconItem.registerOptionsUI!(builder, ctx);

        optionBuilder.addBackground(builder, ctx);
        optionBuilder.addBorder(builder, ctx);
      },

      defaultValue: defaultOptions.root as any,
    });
  });
