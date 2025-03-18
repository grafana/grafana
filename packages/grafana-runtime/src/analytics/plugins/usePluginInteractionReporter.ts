import { useMemo } from 'react';

import { isDataSourcePluginContext, usePluginContext } from '@grafana/data';

import { reportInteraction } from '../utils';

import { createDataSourcePluginEventProperties, createPluginEventProperties } from './eventProperties';

const namePrefix = 'grafana_plugin_';

export function usePluginInteractionReporter(): typeof reportInteraction {
  const context = usePluginContext();

  return useMemo(() => {
    // Happens when the hook is not used inside a plugin (e.g. in core Grafana)
    if (!context) {
      throw new Error(
        `No PluginContext found. The usePluginInteractionReporter() hook can only be used from a plugin.`
      );
    }

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
