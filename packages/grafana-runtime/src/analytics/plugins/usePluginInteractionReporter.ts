import {
  type DataSourcePluginContextType,
  isDataSourcePluginContext,
  type PluginContextType,
  usePluginContext,
} from '@grafana/data';

import { reportInteraction } from '../utils';

import { createDataSourcePluginEventProperties, createPluginEventProperties } from './eventProperties';

export function usePluginInteractionReporter(): typeof reportInteraction {
  const context = usePluginContext();

  if (isDataSourcePluginContext(context)) {
    return createDataSourceReporter(context);
  }

  return createPluginReporter(context);
}

function createDataSourceReporter(context: DataSourcePluginContextType): typeof reportInteraction {
  const { meta, settings } = context;
  const info = createDataSourcePluginEventProperties(meta, settings);

  return (interactionName: string, properties?: Record<string, unknown>) => {
    return reportInteraction(interactionName, { ...properties, ...info });
  };
}

function createPluginReporter(context: PluginContextType): typeof reportInteraction {
  const { meta } = context;
  const info = createPluginEventProperties(meta);

  return (interactionName: string, properties?: Record<string, unknown>) => {
    return reportInteraction(interactionName, { ...properties, ...info });
  };
}
