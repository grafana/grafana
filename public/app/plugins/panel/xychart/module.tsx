import { PanelPlugin } from '@grafana/data';
import { DrawStyle, GraphFieldConfig, LegendDisplayMode } from '@grafana/ui';
import { XYChartPanel } from './XYChartPanel';
import { Options } from './types';
import { XYDimsEditor } from './XYDimsEditor';
import { getGraphFieldConfig, defaultGraphConfig } from '../timeseries/config';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(XYChartPanel)
  .useFieldConfig(
    getGraphFieldConfig({
      ...defaultGraphConfig,
      drawStyle: DrawStyle.Points,
    })
  )
  .setPanelOptions((builder) => {
    builder
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: 'Data',
        editor: XYDimsEditor,
      })
      .addRadio({
        path: 'tooltipOptions.mode',
        name: 'Tooltip mode',
        description: '',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single' },
            { value: 'multi', label: 'All' },
            { value: 'none', label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.displayMode',
        name: 'Legend mode',
        description: '',
        defaultValue: LegendDisplayMode.List,
        settings: {
          options: [
            { value: LegendDisplayMode.List, label: 'List' },
            { value: LegendDisplayMode.Table, label: 'Table' },
            { value: LegendDisplayMode.Hidden, label: 'Hidden' },
          ],
        },
      })
      .addRadio({
        path: 'legend.placement',
        name: 'Legend placement',
        description: '',
        defaultValue: 'bottom',
        settings: {
          options: [
            { value: 'bottom', label: 'Bottom' },
            { value: 'right', label: 'Right' },
          ],
        },
        showIf: (c) => c.legend.displayMode !== LegendDisplayMode.Hidden,
      });
  });
