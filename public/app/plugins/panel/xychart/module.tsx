import { PanelPlugin } from '@grafana/data';
import { DrawStyle, GraphFieldConfig, commonOptionsBuilder } from '@grafana/ui';
import { XYChartPanel } from './XYChartPanel';
import { Options } from './types';
import { XYDimsEditor } from './XYDimsEditor';
import { getGraphFieldConfig, defaultGraphConfig } from '../timeseries/config';
import { ColorDimensionEditor } from '../geomap/dims/editors/ColorDimensionEditor';
import { ScaleDimensionEditor } from '../geomap/dims/editors/ScaleDimensionEditor';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(XYChartPanel)
  .useFieldConfig(
    getGraphFieldConfig({
      ...defaultGraphConfig,
      drawStyle: DrawStyle.Points,
    })
  )
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        defaultValue: 'xy',
        settings: {
          options: [
            { value: 'xy', label: 'XY (aligned)' },
            { value: 'scatter', label: 'Scatter' },
          ],
        },
      })
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: 'Data',
        editor: XYDimsEditor,
        showIf: (cfg) => cfg.mode === 'xy',
      })
      .addFieldNamePicker({
        path: 'trace.x',
        name: 'X Field',
        settings: {
          // filter: (f: Field) => f.type === FieldType.number,
          // noFieldsMessage: 'No numeric fields found',
        },
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addFieldNamePicker({
        path: 'trace.y',
        name: 'Y Field',
        settings: {
          // filter: (f: Field) => f.type === FieldType.number,
          // noFieldsMessage: 'No numeric fields found',
        },
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addCustomEditor({
        id: 'trace.color',
        path: 'trace.color',
        name: 'Trace Color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
      })
      .addCustomEditor({
        id: 'trace.size',
        path: 'trace.size',
        name: 'Trace Size',
        editor: ScaleDimensionEditor,
        settings: {
          min: 1,
          max: 100, // possible in the UI
        },
        defaultValue: {
          // Configured values
          fixed: 5,
          min: 1,
          max: 20,
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
