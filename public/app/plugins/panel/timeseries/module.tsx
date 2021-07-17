import { PanelPlugin } from '@grafana/data';
import { GraphFieldConfig, commonOptionsBuilder } from '@grafana/ui';
import { TimeSeriesPanel } from './TimeSeriesPanel';
import { graphPanelChangedHandler } from './migrations';
import { TimeSeriesOptions } from './types';
import { defaultGraphConfig, getGraphFieldConfig } from './config';
import { CandlestickFieldMappingsEditor } from '../candlestick/CandlestickFieldMappingEditor';

export const plugin = new PanelPlugin<TimeSeriesOptions, GraphFieldConfig>(TimeSeriesPanel)
  .setPanelChangeHandler(graphPanelChangedHandler)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
    // OHLC Mappings editor
    builder.addCustomEditor({
      category: ['Semantic field mappings'],
      id: 'content',
      path: 'semanticFields',
      name: 'Candlestick',
      editor: CandlestickFieldMappingsEditor,
      defaultValue: {},
    });
  })
  .setDataSupport({ annotations: true, alertStates: true });
