import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { AxisSide, GraphCustomFieldConfig } from '@grafana/ui';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options, GraphCustomFieldConfig>(GraphPanel)
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
        .addBooleanSwitch({
          path: 'line.show',
          name: 'Show lines',
          description: '',
          defaultValue: true,
        })
        .addSliderInput({
          path: 'line.width',
          name: 'Line width',
          defaultValue: 1,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => {
            return c.line.show;
          },
        })
        .addBooleanSwitch({
          path: 'points.show',
          name: 'Show points',
          description: '',
          defaultValue: false,
        })
        .addSliderInput({
          path: 'points.radius',
          name: 'Point radius',
          defaultValue: 4,
          settings: {
            min: 1,
            max: 10,
            step: 1,
          },
          showIf: c => c.points.show,
        })
        .addBooleanSwitch({
          path: 'bars.show',
          name: 'Show bars',
          description: '',
          defaultValue: false,
        })
        .addSliderInput({
          path: 'fill.alpha',
          name: 'Fill area opacity',
          defaultValue: 0.1,
          settings: {
            min: 0,
            max: 1,
            step: 0.1,
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
          // no matter what the field type is
          shouldApply: () => true,
        })
        .addRadio({
          path: 'axis.side',
          name: 'Y axis side',
          category: ['Axis'],
          defaultValue: AxisSide.Left,
          settings: {
            options: [
              { value: AxisSide.Left, label: 'Left' },
              { value: AxisSide.Right, label: 'Right' },
            ],
          },
        })
        .addNumberInput({
          path: 'axis.width',
          name: 'Y axis width',
          category: ['Axis'],
          defaultValue: 60,
          settings: {
            placeholder: '60',
          },
        })
        .addBooleanSwitch({
          path: 'axis.grid',
          name: 'Show axis grid',
          category: ['Axis'],
          description: '',
          defaultValue: true,
        })
        .addRadio({
          path: 'nullValues',
          name: 'Display null values as',
          description: '',
          defaultValue: 'null',
          settings: {
            options: [
              { value: 'null', label: 'null' },
              { value: 'connected', label: 'Connected' },
              { value: 'asZero', label: 'Zero' },
            ],
          },
        });
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
