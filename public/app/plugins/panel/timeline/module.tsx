import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { TimelinePanel } from './TimelinePanel';
import { TimelineOptions, TimelineFieldConfig, TimelineMode, defaultTimelineFieldConfig } from './types';
import { BarValueVisibility } from '@grafana/ui';

export const plugin = new PanelPlugin<TimelineOptions, TimelineFieldConfig>(TimelinePanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        settings: {
          byValueSupport: true,
        },
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
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
      .addRadio({
        path: 'mode',
        name: 'Mode',
        defaultValue: TimelineMode.Changes,
        settings: {
          options: [
            { label: 'State changes', value: TimelineMode.Changes },
            { label: 'Periodic samples', value: TimelineMode.Samples },
          ],
        },
      })
      .addRadio({
        path: 'showValue',
        name: 'Show values',
        settings: {
          options: [
            //{ value: BarValueVisibility.Auto, label: 'Auto' },
            { value: BarValueVisibility.Always, label: 'Always' },
            { value: BarValueVisibility.Never, label: 'Never' },
          ],
        },
        defaultValue: BarValueVisibility.Always,
      })
      .addRadio({
        path: 'alignValue',
        name: 'Align value',
        settings: {
          options: [
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ],
        },
        defaultValue: 'center',
        showIf: ({ mode }) => mode === TimelineMode.Changes,
      })
      .addSliderInput({
        path: 'rowHeight',
        name: 'Row height',
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
      })
      .addSliderInput({
        path: 'colWidth',
        name: 'Column width',
        defaultValue: 0.9,
        settings: {
          min: 0,
          max: 1,
          step: 0.01,
        },
        showIf: ({ mode }) => mode === TimelineMode.Samples,
      });

    //addLegendOptions(builder);
  });
