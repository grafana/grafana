import { LiveChannelScope, SelectableValue } from '@grafana/data';

export interface CoreGrafanaLiveFeature {
  name: string;
  description: string;
}

export type ExistingLiveChannelScope = LiveChannelScope & { readonly discriminator: unique symbol };

export interface GrafanaLiveChannelConfigSrv {
  doesScopeExist: (liveChannelScope: LiveChannelScope) => liveChannelScope is ExistingLiveChannelScope;
  getNamespaces: (liveChannelScope: ExistingLiveChannelScope) => Promise<Array<SelectableValue<string>>>;
}
