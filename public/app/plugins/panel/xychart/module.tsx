import { PanelPlugin } from '@grafana/data';
import { DrawStyle, GraphFieldConfig, commonOptionsBuilder } from '@grafana/ui';
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
    builder.addCustomEditor({
      id: 'xyPlotConfig',
      path: 'dims',
      name: 'Data',
      editor: XYDimsEditor,
    });
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
