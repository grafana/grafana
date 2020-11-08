import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { GraphFieldConfig, graphFieldOptions } from '@grafana/ui';
import { PointMode, LineMode, AxisPlacement } from '@grafana/ui/src/components/uPlot/config';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(GraphPanel)
  .useFieldConfig({
    standardOptions: [
      // FieldConfigProperty.Min,
      // FieldConfigProperty.Max,
      FieldConfigProperty.Color,
      FieldConfigProperty.Unit,
      FieldConfigProperty.DisplayName,
      FieldConfigProperty.Decimals,
      // NOT:  FieldConfigProperty.Thresholds,
      FieldConfigProperty.Mappings,
    ],

    useCustomConfig: builder => {
      builder
        .addRadio({
          path: 'line',
          name: 'Mode',
          defaultValue: graphFieldOptions.line[0].value,
          settings: {
            options: graphFieldOptions.line,
          },
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          defaultValue: 1,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => !(c.line === LineMode.Bar || c.line === LineMode.Hide),
        })
        .addSliderInput({
          path: 'fillAlpha',
          name: 'Fill area opacity',
          defaultValue: 0.1,
          settings: {
            min: 0,
            max: 1,
            step: 0.1,
          },
          showIf: c => c.line !== LineMode.Hide,
        })
        .addRadio({
          path: 'points',
          name: 'Points',
          defaultValue: graphFieldOptions.points[0].value,
          settings: {
            options: graphFieldOptions.points,
          },
        })
        .addSliderInput({
          path: 'pointRadius',
          name: 'Point radius',
          defaultValue: 4,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => c.points !== PointMode.Hide,
        })
        .addRadio({
          path: 'axis',
          name: 'Axis',
          defaultValue: graphFieldOptions.axis[0].value,
          settings: {
            options: graphFieldOptions.axis,
          },
        })
        .addTextInput({
          path: 'axis.label',
          name: 'Axis Label',
          category: ['Axis'],
          defaultValue: '',
          settings: {
            placeholder: 'Optional text',
          },
          showIf: c => c.axis !== AxisPlacement.Hide,
          // no matter what the field type is
          shouldApply: () => true,
        })
        .addNumberInput({
          path: 'axisWidth',
          name: 'Y axis width',
          defaultValue: 60,
          settings: {
            placeholder: '60',
          },
          showIf: c => c.axis !== AxisPlacement.Hide,
        })
        .addBooleanSwitch({
          path: 'axisGrid',
          name: 'Show axis grid',
          description: '',
          defaultValue: true,
          showIf: c => c.axis !== AxisPlacement.Hide,
        });
      // .addRadio({
      //   path: 'nullValues',
      //   name: 'Display null values as',
      //   description: '',
      //   defaultValue: 'null',
      //   settings: {
      //     options: [
      //       { value: 'null', label: 'null' },
      //       { value: 'connected', label: 'Connected' },
      //       { value: 'asZero', label: 'Zero' },
      //     ],
      //   },
      // });
    },
  })
  .setPanelOptions(builder => {
    builder
      .addRadio({
        path: 'tooltipOptions.mode',
        name: 'Tooltip mode',
        description: '',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single series' },
            { value: 'multi', label: 'All series' },
            { value: 'none', label: 'No tooltip' },
          ],
        },
      })
      .addBooleanSwitch({
        category: ['Legend'],
        path: 'legend.isVisible',
        name: 'Show legend',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        category: ['Legend'],
        path: 'legend.asTable',
        name: 'Display legend as table',
        description: '',
        defaultValue: false,
        showIf: c => c.legend.isVisible,
      })
      .addRadio({
        category: ['Legend'],
        path: 'legend.placement',
        name: 'Legend placement',
        description: '',
        defaultValue: 'bottom',
        settings: {
          options: [
            { value: 'left', label: 'Left' },
            { value: 'top', label: 'Top' },
            { value: 'bottom', label: 'Bottom' },
            { value: 'right', label: 'Right' },
          ],
        },
        showIf: c => c.legend.isVisible,
      });
  });
