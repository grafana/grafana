import { Observable } from 'rxjs';

import { type LiveChannelAddress, type LiveChannelEvent, LiveChannelScope } from '@grafana/data';
import { type GrafanaLiveSrv, setGrafanaLiveSrv } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { dashboardWatcher } from './dashboardWatcher';

describe('dashboardWatcher', () => {
  let subscribedChannels: LiveChannelAddress[];

  beforeEach(() => {
    subscribedChannels = [];
    const live: Partial<GrafanaLiveSrv> = {
      getStream: <T>(address: LiveChannelAddress) =>
        new Observable<LiveChannelEvent<T>>(() => {
          subscribedChannels.push(address);
        }),
    };
    setGrafanaLiveSrv(live as GrafanaLiveSrv);
  });

  afterEach(() => {
    dashboardWatcher.leave();
    setTestFlags({});
  });

  it('subscribes to the dashboard channel', () => {
    dashboardWatcher.watch('abc');

    expect(subscribedChannels).toEqual([{ scope: LiveChannelScope.Grafana, stream: 'dashboard', path: 'uid/abc' }]);
  });

  it('does not subscribe when dashboards.disableLiveSaveNotices is on', () => {
    setTestFlags({ 'dashboards.disableLiveSaveNotices': true });

    dashboardWatcher.watch('abc');

    expect(subscribedChannels).toEqual([]);
  });
});
