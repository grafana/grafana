import { ReplaySubject } from 'rxjs';

import { PluginExtensionAddedUrlRecognizerConfig, UrlMetadata } from '@grafana/data';

import * as errors from '../errors';

import { PluginExtensionConfigs, Registry, RegistryType } from './Registry';

const logPrefix = 'Could not register URL recognizer extension. Reason:';

export type UrlRecognizerRegistryItem = {
  pluginId: string;
  title: string;
  description?: string;
  recognizer: (url: string) => Promise<UrlMetadata | null>;
  schema?: Record<string, unknown>;
};

export class UrlRecognizersRegistry extends Registry<
  UrlRecognizerRegistryItem[],
  PluginExtensionAddedUrlRecognizerConfig
> {
  constructor(
    options: {
      registrySubject?: ReplaySubject<RegistryType<UrlRecognizerRegistryItem[]>>;
      initialState?: RegistryType<UrlRecognizerRegistryItem[]>;
    } = {}
  ) {
    super(options);
  }

  mapToRegistry(
    registry: RegistryType<UrlRecognizerRegistryItem[]>,
    item: PluginExtensionConfigs<PluginExtensionAddedUrlRecognizerConfig>
  ): RegistryType<UrlRecognizerRegistryItem[]> {
    const { pluginId, configs } = item;
    const registryKey = 'url-recognizers';

    if (!(registryKey in registry)) {
      registry[registryKey] = [];
    }

    for (const config of configs) {
      const { title, description, recognizer, schema } = config;
      const configLog = this.logger.child({
        title,
        description: description ?? '',
        pluginId,
        recognizer: typeof recognizer,
      });

      if (!title) {
        configLog.error(`${logPrefix} ${errors.TITLE_MISSING}`);
        continue;
      }

      if (typeof recognizer !== 'function') {
        configLog.error(`${logPrefix} Recognizer must be a function`);
        continue;
      }

      configLog.debug('URL recognizer extension successfully registered');

      registry[registryKey].push({
        pluginId,
        title,
        description,
        recognizer,
        schema,
      });
    }

    return registry;
  }

  // Returns a read-only version of the registry.
  readOnly() {
    return new UrlRecognizersRegistry({
      registrySubject: this.registrySubject,
    });
  }
}
