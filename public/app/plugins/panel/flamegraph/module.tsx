import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { checkFields } from '@grafana/flamegraph';
import { showDefaultSuggestion } from 'app/features/panel/suggestions/utils';

import { FlameGraphPanel } from './FlameGraphPanel';

const flamegraphConfigOptions = [FieldConfigProperty.Unit, FieldConfigProperty.Decimals];

export const plugin = new PanelPlugin(FlameGraphPanel)
  // check that the first frame of the data has the required fields for a flamegraph
  .setSuggestionsSupplier(
    showDefaultSuggestion((ds) => {
      const firstFrame = ds.rawFrames?.[0];
      return Boolean(firstFrame && !checkFields(firstFrame));
    })
  )
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => !flamegraphConfigOptions.includes(v)),
  });
