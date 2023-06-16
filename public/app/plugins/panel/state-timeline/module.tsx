import {
  FieldColorModeId,
  FieldConfigProperty,
  FieldType,
  identityOverrideProcessor,
  PanelPlugin,
} from '@grafana/data';
import { VisibilityMode } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { SpanNullsEditor } from '../timeseries/SpanNullsEditor';

import { StateTimelinePanel } from './StateTimelinePanel';
import { timelinePanelChangedHandler } from './migrations';
import { Options, FieldConfig, defaultOptions, defaultFieldConfig } from './panelcfg.gen';
import { StatTimelineSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<Options, FieldConfig>(StateTimelinePanel)
  .setPanelChangeHandler(timelinePanelChangedHandler)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.ContinuousGrYlRd,
        },
      },
    },
    useCustomConfig: (builder) => {
      builder
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: defaultFieldConfig.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: defaultFieldConfig.fillOpacity,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addCustomEditor<void, boolean>({
          id: 'spanNulls',
          path: 'spanNulls',
          name: 'Connect null values',
          defaultValue: false,
          editor: SpanNullsEditor,
          override: SpanNullsEditor,
          shouldApply: (f) => f.type !== FieldType.time,
          process: identityOverrideProcessor,
        });

      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'mergeValues',
        name: 'Merge equal consecutive values',
        defaultValue: defaultOptions.mergeValues,
      })
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
          options: [
            { value: VisibilityMode.Auto, label: 'Auto' },
            { value: VisibilityMode.Always, label: 'Always' },
            { value: VisibilityMode.Never, label: 'Never' },
          ],
        },
        defaultValue: defaultOptions.showValue,
      })
      .addRadio({
        path: 'alignValue',
        name: 'Align values',
        settings: {
          options: [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ],
        },
        defaultValue: defaultOptions.alignValue,
      })
      .addSliderInput({
        path: 'rowHeight',
        name: 'Row height',
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
        defaultValue: defaultOptions.rowHeight,
      });

    commonOptionsBuilder.addLegendOptions(builder, false);
    commonOptionsBuilder.addTooltipOptions(builder, true);
  })
  .setSuggestionsSupplier(new StatTimelineSuggestionsSupplier())
  .setDataSupport({ annotations: true });
