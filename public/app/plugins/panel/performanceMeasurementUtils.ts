import afterFrame from 'afterframe';

import { faro } from '@grafana/faro-web-sdk';

interface LogArg {
  [key: string]: string;
}

export const NULL_VALUE = 'NULL_VALUE';

export function faroMeasureInteraction(interactionName: string, context: string) {
  const startTimestamp = performance.now();

  return {
    end() {
      // console.log('The '+ interactionName + ' took', endTimestamp - startTimestamp, 'ms');
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
  const interaction = faroMeasureInteraction(interactionName, context);

  afterFrame(() => {
    interaction.end();
  });

  faro.api.pushEvent(interactionName, logArgs, context);
}
