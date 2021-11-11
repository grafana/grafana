import { LiveChannelScope, SelectableValue } from '@grafana/data';
import { config } from 'app/core/config';
import { CoreGrafanaLiveFeature } from './types';

export abstract class GrafanaLiveScope {
  constructor(protected scope: LiveChannelScope) {}

  /**
   * List the possible values within this scope
   */
  abstract listNamespaces(): Promise<Array<SelectableValue<string>>>;
}

class GrafanaLiveCoreScope extends GrafanaLiveScope {
  readonly namespaces: Array<SelectableValue<string>> = [];

  constructor() {
    super(LiveChannelScope.Grafana);
  }

  register(feature: CoreGrafanaLiveFeature) {
    this.namespaces.push({
      value: feature.name,
      label: feature.name,
      description: feature.description,
    });
  }

  /**
   * List the possible values within this scope
   */
  listNamespaces() {
    return Promise.resolve(this.namespaces);
  }
}
export const grafanaLiveCoreFeatures = new GrafanaLiveCoreScope();

export class GrafanaLiveDataSourceScope extends GrafanaLiveScope {
  names?: Array<SelectableValue<string>>;

  constructor() {
    super(LiveChannelScope.DataSource);
  }

  /**
   * List the possible values within this scope
   */
  async listNamespaces() {
    if (this.names) {
      return Promise.resolve(this.names);
    }

    const names: Array<SelectableValue<string>> = [];

    for (const ds of Object.values(config.datasources)) {
      if (ds.meta.live) {
        try {
          names.push({
            label: ds.name,
            value: ds.type,
            description: ds.type,
          });
        } catch (err) {
          err.isHandled = true;
        }
      }
    }

    return (this.names = names);
  }
}

export class GrafanaLivePluginScope extends GrafanaLiveScope {
  names?: Array<SelectableValue<string>>;

  constructor() {
    super(LiveChannelScope.Plugin);
  }

  /**
   * List the possible values within this scope
   */
  async listNamespaces() {
    if (this.names) {
      return Promise.resolve(this.names);
    }
    const names: Array<SelectableValue<string>> = [];
    // TODO add list to config
    for (const panel of Object.values(config.panels)) {
      if (panel.live) {
        names.push({
          label: panel.name,
          value: panel.type,
          description: panel.info?.description,
        });
      }
    }
    return (this.names = names);
  }
}

export class GrafanaLiveStreamScope extends GrafanaLiveScope {
  names?: Array<SelectableValue<string>>;

  constructor() {
    super(LiveChannelScope.Stream);
  }

  /**
   * List the possible values within this scope
   */
  async listNamespaces() {
    if (this.names) {
      return Promise.resolve(this.names);
    }
    const names: Array<SelectableValue<string>> = [];

    // TODO!!!

    return (this.names = names);
  }
}
