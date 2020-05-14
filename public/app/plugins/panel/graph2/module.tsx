import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options>(GraphPanel)
  .useFieldConfig({ standardOptions: [FieldConfigProperty.Unit, FieldConfigProperty.Decimals] })
  .setPanelOptions(builder => {
    builder
      .addBooleanSwitch({
        path: 'graph.showBars',
        name: 'Show bars',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'graph.showLines',
        name: 'Show lines',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'graph.showPoints',
        name: 'Show poins',
        description: '',
        defaultValue: false,
      })
      .addBooleanSwitch({
        path: 'legend.isVisible',
        name: 'Show legend',
        description: '',
        defaultValue: true,
      })
      .addBooleanSwitch({
        path: 'legend.asTable',
        name: 'Display legend as table',
        description: '',
        defaultValue: false,
      })
      .addRadio({
        path: 'legend.placement',
        name: 'Legend placement',
        description: '',
        defaultValue: 'under',
        settings: {
          options: [
            { value: 'under', label: 'Below graph' },
            { value: 'right', label: 'Right to the graph' },
          ],
        },
      })
      .addRadio({
        path: 'tooltipOptions.mode',
        name: 'Tooltip mode',
        description: '',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single series' },
            { value: 'multi', label: 'All series' },
          ],
        },
      });
  });
