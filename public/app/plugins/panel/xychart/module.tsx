import { GraphFieldConfig, GraphDrawStyle } from '@grafana/schema';
import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { XYChartPanel } from './XYChartPanel';
import { Options } from './types';
import { XYDimsEditor } from './XYDimsEditor';
import { getGraphFieldConfig, defaultGraphConfig } from '../timeseries/config';
import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';

export const plugin = new PanelPlugin<Options, GraphFieldConfig>(XYChartPanel)
  .useFieldConfig(
    getGraphFieldConfig({
      ...defaultGraphConfig,
      drawStyle: GraphDrawStyle.Points,
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
        path: 'series.x',
        name: 'X Field',
        settings: {
          // filter: (f: Field) => f.type === FieldType.number,
          // noFieldsMessage: 'No numeric fields found',
        },
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addFieldNamePicker({
        path: 'series.y',
        name: 'Y Field',
        settings: {
          // filter: (f: Field) => f.type === FieldType.number,
          // noFieldsMessage: 'No numeric fields found',
        },
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addCustomEditor({
        id: 'series.color',
        path: 'series.color',
        name: 'Marker color',
        editor: ColorDimensionEditor,
        settings: {},
        defaultValue: {
          // Configured values
          fixed: 'grey',
        },
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addCustomEditor({
        id: 'series.size',
        path: 'series.size',
        name: 'Marker size',
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
        showIf: (cfg) => cfg.mode === 'scatter',
      })
      .addCustomEditor({
        id: 'series.label',
        path: 'series.label',
        name: 'Marker label',
        editor: TextDimensionEditor,
        showIf: (cfg) => cfg.mode === 'scatter',
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
