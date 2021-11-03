import { LiveChannelScope, LiveChannelSupport, SelectableValue } from '@grafana/data';

export interface CoreGrafanaLiveFeature {
  name: string;
  support: LiveChannelSupport;
  description: string;
}

export type ExistingLiveChannelScope = LiveChannelScope & { readonly discriminator: unique symbol };

export interface GrafanaLiveChannelConfigSrv {
  doesScopeExist: (liveChannelScope: LiveChannelScope) => liveChannelScope is ExistingLiveChannelScope;
  getChannelSupport: (
    liveChannelScope: ExistingLiveChannelScope,
    namespace: string
  ) => Promise<LiveChannelSupport | undefined>;
  getNamespaces: (liveChannelScope: ExistingLiveChannelScope) => Promise<Array<SelectableValue<string>>>;
}
