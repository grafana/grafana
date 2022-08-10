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
import { StatTimelineSuggestionsSupplier } from './suggestions';
import { TimelineOptions, TimelineFieldConfig, defaultPanelOptions, defaultTimelineFieldConfig } from './types';

export const plugin = new PanelPlugin<TimelineOptions, TimelineFieldConfig>(StateTimelinePanel)
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
          defaultValue: defaultTimelineFieldConfig.lineWidth,
          settings: {
            min: 0,
            max: 10,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          defaultValue: defaultTimelineFieldConfig.fillOpacity,
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
    },
  })
  .setPanelOptions((builder) => {
    builder
      .addBooleanSwitch({
        path: 'mergeValues',
        name: 'Merge equal consecutive values',
        defaultValue: defaultPanelOptions.mergeValues,
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
        defaultValue: defaultPanelOptions.showValue,
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
        defaultValue: defaultPanelOptions.alignValue,
      })
      .addSliderInput({
        path: 'rowHeight',
        name: 'Row height',
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
        defaultValue: defaultPanelOptions.rowHeight,
      });

    commonOptionsBuilder.addLegendOptions(builder, false);
    commonOptionsBuilder.addTooltipOptions(builder, true);
  })
  .setSuggestionsSupplier(new StatTimelineSuggestionsSupplier())
  .setDataSupport({ annotations: true });
