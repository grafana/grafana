import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { StateTimelinePanel } from './StateTimelinePanel';
import { TimelineOptions, TimelineFieldConfig, defaultPanelOptions, defaultTimelineFieldConfig } from './types';
import { BarValueVisibility } from '@grafana/ui';
import { addLegendOptions } from '@grafana/ui/src/options/builder';
import { timelinePanelChangedHandler } from './migrations';

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
            { value: BarValueVisibility.Auto, label: 'Auto' },
            { value: BarValueVisibility.Always, label: 'Always' },
            { value: BarValueVisibility.Never, label: 'Never' },
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

    addLegendOptions(builder, false);
  });
