import { LiveChannelScope, LiveChannelSupport, SelectableValue } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { config } from 'app/core/config';
import { loadPlugin } from '../plugins/PluginPage';

export abstract class GrafanaLiveScope {
  constructor(protected scope: LiveChannelScope) {}

  /**
   * Load the real namespaces
   */
  abstract async getChannelSupport(namespace: string): Promise<LiveChannelSupport | undefined>;

  /**
   * List the possible values within this scope
   */
  abstract async listNamespaces(): Promise<Array<SelectableValue<string>>>;
}

export interface CoreGrafanaLiveFeature {
  name: string;
  support: LiveChannelSupport;
  description: string;
}

class GrafanaLiveCoreScope extends GrafanaLiveScope {
  readonly features = new Map<string, LiveChannelSupport>();
  readonly namespaces: Array<SelectableValue<string>> = [];

  constructor() {
    super(LiveChannelScope.Grafana);
  }

  register(feature: CoreGrafanaLiveFeature) {
    this.features.set(feature.name, feature.support);
    this.namespaces.push({
      value: feature.name,
      label: feature.name,
      description: feature.description,
    });
  }

  /**
   * Load the real namespaces
   */
  async getChannelSupport(namespace: string) {
    const v = this.features.get(namespace);
    if (v) {
      return Promise.resolve(v);
    }
    throw new Error('unknown feature: ' + namespace);
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
   * Load the real namespaces
   */
  async getChannelSupport(namespace: string) {
    const ds = await getDataSourceSrv().get(namespace);
    return ds.channelSupport;
  }

  /**
   * List the possible values within this scope
   */
  async listNamespaces() {
    if (this.names) {
      return Promise.resolve(this.names);
    }
    const names: Array<SelectableValue<string>> = [];
    for (const [key, ds] of Object.entries(config.datasources)) {
      if (ds.meta.live) {
        try {
          const s = this.getChannelSupport(key); // ds.name or ID?
          if (s) {
            names.push({
              label: ds.name,
              value: ds.type,
              description: ds.type,
            });
          }
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
   * Load the real namespaces
   */
  async getChannelSupport(namespace: string) {
    const plugin = await loadPlugin(namespace);
    if (!plugin.channelSupport) {
      throw new Error('Unknown plugin: ' + namespace);
    }
    return plugin.channelSupport;
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
    for (const [key, panel] of Object.entries(config.panels)) {
      if (panel.live) {
        try {
          const s = this.getChannelSupport(key); // ds.name or ID?
          if (s) {
            names.push({
              label: panel.name,
              value: key,
              description: panel.info?.description,
            });
          }
        } catch (err) {
          err.isHandled = true;
        }
      }
    }
    return (this.names = names);
  }
}
