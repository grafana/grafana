import { useMemo } from 'react';

import { isDataSourcePluginContext, usePluginContext } from '@grafana/data';

import { reportInteraction } from '../utils';

import { createDataSourcePluginEventProperties, createPluginEventProperties } from './eventProperties';

export function usePluginInteractionReporter(): typeof reportInteraction {
  const context = usePluginContext();

  return useMemo(() => {
    const info = isDataSourcePluginContext(context)
      ? createDataSourcePluginEventProperties(context.instanceSettings)
      : createPluginEventProperties(context.meta);

    return (interactionName: string, properties?: Record<string, unknown>) => {
      return reportInteraction(interactionName, { ...properties, ...info });
    };
  }, [context]);
}
