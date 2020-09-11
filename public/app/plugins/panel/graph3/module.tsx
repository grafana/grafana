import { PanelPlugin } from '@grafana/data';
import { GraphPanel } from './GraphPanel';
import { Options } from './types';

export const plugin = new PanelPlugin<Options>(GraphPanel)
  .useFieldConfig({
    useCustomConfig: builder => {
      builder
        .addBooleanSwitch({
          path: 'showLines',
          name: 'Show lines',
          description: '',
          defaultValue: true,
        })
        .addSelect({
          path: 'lineWidth',
          name: 'Line width',
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
          showIf: cfg => {
            console.log('SHOW???', cfg);
            return true; //cfg.custom.showLines;
          },
        })
        .addBooleanSwitch({
          path: 'showPoints',
          name: 'Show points',
          description: '',
          defaultValue: false,
        })
        .addSelect({
          path: 'pointRadius',
          name: 'Point radius',
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
          showIf: cfg => {
            console.log('SHOW???', cfg);
            return true; //cfg.custom.showLines;
          },
        })
        .addBooleanSwitch({
          path: 'showBars',
          name: 'Show bars',
          description: '',
          defaultValue: false,
        })
        .addSelect({
          path: 'fillAlpha',
          name: 'Fill Area',
          settings: {
            options: [
              { value: 0, label: 'No Fill' },
              { value: 0.1, label: '10% • transparent' },
              { value: 0.2, label: '20%' },
              { value: 0.3, label: '30%' },
              { value: 0.4, label: '40%' },
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
          path: 'axisLabel',
          name: 'Axis Label',
          settings: {
            placeholder: 'Optional text',
          },
          // no matter what the field type is
          shouldApply: () => true,
        })
        .addBooleanSwitch({
          path: 'axisGrid',
          name: 'Show axis grid',
          description: '',
          defaultValue: true,
        })
        .addRadio({
          path: 'axisSide',
          name: 'Y axis side',
          defaultValue: { value: 3, label: 'Left' },
          settings: {
            options: [
              { value: 3, label: 'Left' },
              { value: 1, label: 'Right' },
            ],
          },
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
        path: 'graph.realTimeUpdates',
        name: 'Real time updates',
        description: 'continue to update the graph so the time axis matches the clock.',
        defaultValue: false,
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
      })
      .addRadio({
        category: ['Legend'],
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
      });
  });
