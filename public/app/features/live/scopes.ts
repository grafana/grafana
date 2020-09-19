import { LiveChannelScope, LiveChannelSupport, SelectableValue } from '@grafana/data';

export abstract class GrafanaLiveScope {
  constructor(protected scope: LiveChannelScope) {}

  /**
   * Load the real namespaces
   */
  abstract async getChannelSupport(namespace: string): Promise<LiveChannelSupport>;

  /**
   * List the possible values within this scope
   */
  abstract async listNamespaces(): Promise<Array<SelectableValue<string>>>;
}

class GrafanaLiveCoreScope extends GrafanaLiveScope {
  readonly features = new Map<string, LiveChannelSupport>();
  readonly namespaces: Array<SelectableValue<string>> = [];

  constructor() {
    super(LiveChannelScope.Grafana);
  }

  register(feature: string, support: LiveChannelSupport, description: string): GrafanaLiveCoreScope {
    this.features.set(feature, support);
    this.namespaces.push({
      value: feature,
      label: feature,
      description,
    });
    return this;
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

class GrafanaLiveDataSourceScope extends GrafanaLiveScope {
  constructor() {
    super(LiveChannelScope.DataSource);
  }

  /**
   * Load the real namespaces
   */
  async getChannelSupport(namespace: string) {
    return Promise.reject('unknown!');
  }

  /**
   * List the possible values within this scope
   */
  listNamespaces() {
    return Promise.resolve([]);
  }
}

class GrafanaLivePluginScope extends GrafanaLiveScope {
  constructor() {
    super(LiveChannelScope.Plugin);
  }

  /**
   * Load the real namespaces
   */
  async getChannelSupport(namespace: string) {
    return Promise.reject('unknown!');
  }

  /**
   * List the possible values within this scope
   */
  listNamespaces() {
    return Promise.resolve([]);
  }
}

export const grafanaLiveScopes: Record<LiveChannelScope, GrafanaLiveScope> = {
  [LiveChannelScope.Grafana]: grafanaLiveCoreFeatures,
  [LiveChannelScope.DataSource]: new GrafanaLiveDataSourceScope(),
  [LiveChannelScope.Plugin]: new GrafanaLivePluginScope(),
};
