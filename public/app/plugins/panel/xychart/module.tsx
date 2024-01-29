import { PanelPlugin } from '@grafana/data';
// import {
//   FieldType,
//   identityOverrideProcessor,
// } from '@grafana/data';
import { LineStyle } from '@grafana/schema';
import { commonOptionsBuilder } from '@grafana/ui';

import { LineStyleEditor } from '../timeseries/LineStyleEditor';

import { AutoEditor } from './AutoEditor';
import { ManualEditor } from './ManualEditor';
import { XYChartPanel } from './XYChartPanel';
import { getScatterFieldConfig, DEFAULT_POINT_SIZE } from './config';
import { Options, FieldConfig, defaultFieldConfig, ScatterShow } from './panelcfg.gen';

export const plugin = new PanelPlugin<Options, FieldConfig>(XYChartPanel)
  .useFieldConfig(getScatterFieldConfig(defaultFieldConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'seriesMapping',
        name: 'Series mapping',
        defaultValue: 'auto',
        settings: {
          options: [
            { value: 'auto', label: 'Table', description: 'Plot values within a single table result' },
            { value: 'manual', label: 'Manual', description: 'Construct values from any result' },
          ],
        },
      })
      .addCustomEditor({
        id: 'xyPlotConfig',
        path: 'dims',
        name: '',
        editor: AutoEditor,
        showIf: (cfg) => cfg.seriesMapping === 'auto',
      })
      .addCustomEditor({
        id: 'series',
        path: 'series',
        name: '',
        defaultValue: [],
        editor: ManualEditor,
        showIf: (cfg) => cfg.seriesMapping === 'manual',
      })
      .addRadio({
        path: 'show',
        name: 'Show',
        defaultValue: ScatterShow.Points,
        settings: {
          options: [
            { label: 'Points', value: ScatterShow.Points },
            { label: 'Lines', value: ScatterShow.Lines },
            { label: 'Both', value: ScatterShow.PointsAndLines },
          ],
        },
      })
      // .addGenericEditor(
      //   {
      //     path: 'pointSymbol',
      //     name: 'Point symbol',
      //     defaultValue: defaultFieldConfig.pointSymbol ?? {
      //       mode: 'fixed',
      //       fixed: 'img/icons/marker/circle.svg',
      //     },
      //     settings: {
      //       resourceType: MediaType.Icon,
      //       folderName: ResourceFolderName.Marker,
      //       placeholderText: 'Select a symbol',
      //       placeholderValue: 'img/icons/marker/circle.svg',
      //       showSourceRadio: false,
      //     },
      //     showIf: (c) => c.show !== ScatterShow.Lines,
      //   },
      //   SymbolEditor // ResourceDimensionEditor
      // )
      .addSliderInput({
        path: 'pointSize.fixed',
        name: 'Point size',
        defaultValue: DEFAULT_POINT_SIZE,
        settings: {
          min: 1,
          max: 100,
          step: 1,
        },
        // showIf: (c) => c.show !== ScatterShow.Lines,
        showIf: (cfg) => cfg.show !== ScatterShow.Lines,
      })
      // .addSliderInput({
      //   path: 'fillOpacity',
      //   name: 'Fill opacity',
      //   defaultValue: 0.4, // defaultFieldConfig.fillOpacity,
      //   settings: {
      //     min: 0, // hidden?  or just outlines?
      //     max: 1,
      //     step: 0.05,
      //   },
      //   showIf: (c) => c.show !== ScatterShow.Lines,
      // })
      .addCustomEditor<void, LineStyle>({
        id: 'lineStyle',
        path: 'lineStyle',
        name: 'Line style',
        showIf: (cfg) => cfg.show !== ScatterShow.Points,
        editor: LineStyleEditor,
        // override: LineStyleEditor,
        // process: identityOverrideProcessor,
        // shouldApply: (f) => f.type === FieldType.number,
      })
      .addSliderInput({
        path: 'lineWidth',
        name: 'Line width',
        defaultValue: 5,
        settings: {
          min: 0,
          max: 10,
          step: 1,
        },
        showIf: (cfg) => cfg.show !== ScatterShow.Points,
      });

    commonOptionsBuilder.addTooltipOptions(builder, true);
    commonOptionsBuilder.addLegendOptions(builder);
  });
