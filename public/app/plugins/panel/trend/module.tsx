import { PanelPlugin } from '@grafana/data';
import { commonOptionsBuilder } from '@grafana/ui';

import { defaultGraphConfig, getGraphFieldConfig } from '../timeseries/config';

import { TrendPanel } from './TrendPanel';
import { PanelFieldConfig, PanelOptions } from './panelcfg.gen';
import { TrendSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin<PanelOptions, PanelFieldConfig>(TrendPanel)
  .useFieldConfig(getGraphFieldConfig(defaultGraphConfig))
  .setPanelOptions((builder) => {
    commonOptionsBuilder.addTooltipOptions(builder);
    commonOptionsBuilder.addLegendOptions(builder);
  })
  .setSuggestionsSupplier(new TrendSuggestionsSupplier());
//.setDataSupport({ annotations: true, alertStates: true });
