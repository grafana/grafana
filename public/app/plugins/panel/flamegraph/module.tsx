import { FieldConfigProperty, PanelPlugin } from '@grafana/data';

import { FlameGraphPanel } from './FlameGraphPanel';
import { FlameGraphSuggestionsSupplier } from './suggestions';

export const plugin = new PanelPlugin(FlameGraphPanel)
  .setSuggestionsSupplier(new FlameGraphSuggestionsSupplier())
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => v !== FieldConfigProperty.Unit),
    standardOptions: {
      [FieldConfigProperty.Unit]: {},
    },
  });
