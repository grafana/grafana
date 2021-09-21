import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';
import { XYChartPanel } from './XYChartPanel';
import { defaultScatterConfig, XYChartOptions, ScatterFieldConfig } from './models.gen';
import { getScatterFieldConfig } from './config';
import { ExplicitEditor } from './ExplicitEditor';
// import { ColorDimensionEditor, ScaleDimensionEditor, TextDimensionEditor } from 'app/features/dimensions/editors';

export const plugin = new PanelPlugin<XYChartOptions, ScatterFieldConfig>(XYChartPanel)
  .useFieldConfig(getScatterFieldConfig(defaultScatterConfig))
  .setPanelOptions((builder) => {
    builder
      .addRadio({
        path: 'mode',
        name: 'Mode',
        defaultValue: 'single',
        settings: {
          options: [
            { value: 'single', label: 'Single' },
            { value: 'explicit', label: 'Explicit' },
          ],
        },
      })
      .addCustomEditor({
        id: 'yyExplicit',
        path: 'series',
        name: 'Series',
        editor: ExplicitEditor,
        showIf: (cfg) => cfg.mode === 'explicit',
      })
      .addFieldNamePicker({
        path: 'single.x',
        name: 'X field',
        showIf: (cfg) => cfg.mode === 'single',
        settings: {
          placeholderText: 'select field',
        },
      })
      .addFieldNamePicker({
        path: 'single.y',
        name: 'Y field',
        showIf: (cfg) => cfg.mode === 'single',
        settings: {
          placeholderText: 'select field',
        },
      });

    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  });
