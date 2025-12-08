import { FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { checkFields } from '@grafana/flamegraph';

import { FlameGraphPanel } from './FlameGraphPanel';
import { Options } from './types';

const flamegraphConfigOptions = [FieldConfigProperty.Unit, FieldConfigProperty.Decimals];

export const plugin = new PanelPlugin<Options>(FlameGraphPanel)
  // check that the first frame of the data has the required fields for a flamegraph
  .setSuggestionsSupplier((ds) => {
    if (!ds.rawFrames?.some((frame) => checkFields(frame) === undefined)) {
      return;
    }

    return [
      {
        cardOptions: {
          previewModifier: (s) => {
            s.options = s.options || {};
            s.options.showFlameGraphOnly = true;
          },
        },
      },
    ];
  })
  .useFieldConfig({
    disableStandardOptions: Object.values(FieldConfigProperty).filter((v) => !flamegraphConfigOptions.includes(v)),
  });
