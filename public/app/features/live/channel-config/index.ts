import { LiveChannelScope, SelectableValue } from '@grafana/data';
import {
  grafanaLiveCoreFeatures,
  GrafanaLiveDataSourceScope,
  GrafanaLivePluginScope,
  GrafanaLiveScope,
  GrafanaLiveStreamScope,
} from './scope';
import { GrafanaLiveChannelConfigSrv, ExistingLiveChannelScope } from './types';

export class GrafanaLiveChannelConfigService implements GrafanaLiveChannelConfigSrv {
  private readonly scopes: Record<LiveChannelScope, GrafanaLiveScope>;

  constructor() {
    this.scopes = Object.freeze({
      [LiveChannelScope.Grafana]: grafanaLiveCoreFeatures,
      [LiveChannelScope.DataSource]: new GrafanaLiveDataSourceScope(),
      [LiveChannelScope.Plugin]: new GrafanaLivePluginScope(),
      [LiveChannelScope.Stream]: new GrafanaLiveStreamScope(),
    });
  }

  private getScope = (liveChannelScope: ExistingLiveChannelScope): GrafanaLiveScope =>
    this.scopes[liveChannelScope as LiveChannelScope];

  doesScopeExist = (liveChannelScope: LiveChannelScope): liveChannelScope is ExistingLiveChannelScope =>
    Boolean(this.scopes[liveChannelScope]);

  getNamespaces = async (liveChannelScope: ExistingLiveChannelScope): Promise<Array<SelectableValue<string>>> =>
    this.getScope(liveChannelScope).listNamespaces();
}
