import afterFrame from 'afterframe';

import { faro } from '@grafana/faro-web-sdk';

interface LogArg {
  [key: string]: string;
}

export const NULL_VALUE = 'NULL_VALUE';

export function faroMeasureInteraction(context: string) {
  const startTimestamp = performance.now();

  return {
    end() {
      faro.api.pushMeasurement(
        {
          type: 'internal_panel_measurements_' + context,
          values: {
            load_time_ms: performance.now() - startTimestamp,
          },
        }
        // should be fixed by https://github.com/grafana/faro-web-sdk/pull/256/
        // {
        //   context: {
        //     panel_type: props.panelType,
        //   }
        // }
      );
    },
  };
}

export function faroMeasureAndLogEvent(interactionName: string, logArgs: LogArg, context: string) {
  const interaction = faroMeasureInteraction(context);

  afterFrame(() => {
    interaction.end();
  });

  faro.api.pushEvent(interactionName, logArgs, context);
}
