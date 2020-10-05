import {
  FieldColor,
  FieldConfigProperty,
  identityOverrideProcessor,
  PanelPlugin,
  standardEditorsRegistry,
} from '@grafana/data';
import { GraphCustomFieldConfig } from '@grafana/ui';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options, GraphCustomFieldConfig>(GraphPanel)
  .useFieldConfig({
    standardOptions: [
      // FieldConfigProperty.Min,
      // FieldConfigProperty.Max,
      FieldConfigProperty.Unit,
      FieldConfigProperty.DisplayName,
      FieldConfigProperty.Decimals,
      // NOT:  FieldConfigProperty.Thresholds,
      FieldConfigProperty.Mappings,
    ],

    useCustomConfig: builder => {
      builder
        // TODO:  Until we fix standard color property let's do it the custom editor way
        .addCustomEditor<{}, FieldColor>({
          path: 'line.color',
          id: 'line.color',
          name: 'Series color',
          shouldApply: () => true,
          settings: {
            allowUndefined: true,
            textWhenUndefined: 'Automatic',
          },
          defaultValue: undefined,
          editor: standardEditorsRegistry.get('color').editor as any,
          override: standardEditorsRegistry.get('color').editor as any,
          process: identityOverrideProcessor,
        })
        .addBooleanSwitch({
          path: 'line.show',
          name: 'Show lines',
          description: '',
          defaultValue: true,
        })
        .addSelect({
          path: 'line.width',
          name: 'Line width',
          defaultValue: 1,
          settings: {
            options: [
              { value: 1, label: '1 • thin' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
              { value: 5, label: '5' },
              { value: 6, label: '6' },
              { value: 7, label: '7' },
              { value: 8, label: '8' },
              { value: 9, label: '9' },
              { value: 10, label: '10 • thick' },
            ],
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
        .addSelect({
          path: 'points.radius',
          name: 'Point radius',
          defaultValue: 4,
          settings: {
            options: [
              { value: 1, label: '1 • thin' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
              { value: 5, label: '5' },
              { value: 6, label: '6' },
              { value: 7, label: '7' },
              { value: 8, label: '8' },
              { value: 9, label: '9' },
              { value: 10, label: '10 • thick' },
            ],
          },
          showIf: c => c.points.show,
        })
        .addBooleanSwitch({
          path: 'bars.show',
          name: 'Show bars',
          description: '',
          defaultValue: false,
        })
        .addSelect({
          path: 'fill.alpha',
          name: 'Fill area opacity',
          defaultValue: 0.1,
          settings: {
            options: [
              { value: 0, label: 'No Fill' },
              { value: 0.1, label: '10% • transparent' },
              { value: 0.2, label: '20%' },
              { value: 0.3, label: '30%' },
              { value: 0.4, label: '40% ' },
              { value: 0.5, label: '50%' },
              { value: 0.6, label: '60%' },
              { value: 0.7, label: '70%' },
              { value: 0.8, label: '80%' },
              { value: 0.9, label: '90%' },
              { value: 1, label: '100% • opaque' },
            ],
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
          defaultValue: 3,
          settings: {
            options: [
              { value: 3, label: 'Left' },
              { value: 1, label: 'Right' },
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
      // .addBooleanSwitch({
      //   path: 'graph.realTimeUpdates',
      //   name: 'Real time updates',
      //   description: 'continue to update the graph so the time axis matches the clock.',
      //   defaultValue: false,
      // })
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
