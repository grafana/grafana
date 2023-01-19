import { useMemo } from 'react';

import { isDataSourcePluginContext, usePluginContext } from '@grafana/data';

import { reportInteraction } from '../utils';

import { createDataSourcePluginEventProperties, createPluginEventProperties } from './eventProperties';

const namePrefix = 'grafana_plugin_';

export function usePluginInteractionReporter(): typeof reportInteraction {
  const context = usePluginContext();

  return useMemo(() => {
    const info = isDataSourcePluginContext(context)
      ? createDataSourcePluginEventProperties(context.instanceSettings)
      : createPluginEventProperties(context.meta);

    return (interactionName: string, properties?: Record<string, unknown>) => {
      if (!validInteractionName(interactionName)) {
        throw new Error(`Interactions reported in plugins should start with: "${namePrefix}".`);
      }
      return reportInteraction(interactionName, { ...properties, ...info });
    };
  }, [context]);
}

function validInteractionName(interactionName: string): boolean {
  return interactionName.startsWith(namePrefix) && interactionName.length > namePrefix.length;
}
