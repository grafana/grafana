import { FieldConfigProperty, PanelPlugin } from '@grafana/data';

import { FlameGraphPanel } from './FlameGraphPanel';
import { FlameGraphSuggestionsSupplier } from './suggestions';

const flamegraphConfigOptions = [FieldConfigProperty.Unit, FieldConfigProperty.Decimals];

export const plugin = new PanelPlugin(FlameGraphPanel)
  .setSuggestionsSupplier(new FlameGraphSuggestionsSupplier())
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => !flamegraphConfigOptions.includes(v)),
  });
