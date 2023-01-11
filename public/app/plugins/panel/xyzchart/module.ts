import { PanelPlugin } from '@grafana/data';


import { ScatterPlotPanel } from './ScatterPlotPanel';
import { XYZDimsEditor } from './XYZDimsEditor';
import { defaultScatterConfig, ScatterPlotOptions } from './models.gen';

export const plugin = new PanelPlugin<ScatterPlotOptions>(ScatterPlotPanel).setPanelOptions((builder) => {
  builder
    .addRadio({
      path: 'seriesMapping',
      name: 'Series mapping',
      defaultValue: defaultScatterConfig.seriesMapping,
      settings: {
        options: [
          { value: 'auto', label: 'Auto' },
          { value: 'manual', label: 'Manual' },
        ],
      },
    })
    .addCustomEditor({
      id: 'xyPlotConfig',
      path: 'dims',
      name: 'Data',
      editor: XYZDimsEditor,
      showIf: (cfg) => cfg.seriesMapping === 'auto',
    })
    .addFieldNamePicker({
      path: 'series.x',
      name: 'X Field',
      showIf: (cfg) => cfg.seriesMapping === 'manual',
    })
    .addFieldNamePicker({
      path: 'series.y',
      name: 'Y Field',
      showIf: (cfg) => cfg.seriesMapping === 'manual',
    })
    .addFieldNamePicker({
      path: 'series.z',
      name: 'Z Field',
      showIf: (cfg) => cfg.seriesMapping === 'manual',
    })
    .addColorPicker({
      path: 'pointColor',
      name: 'Point color',
      settings: {},
      defaultValue: defaultScatterConfig.pointColor,
    })
    .addNumberInput({
      path: 'pointSize',
      name: 'Point size',
      settings: {},
      defaultValue: defaultScatterConfig.pointSize,
    });
});
