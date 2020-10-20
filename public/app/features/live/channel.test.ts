import { LiveChannelAddress, LiveChannelEvent } from '@grafana/data';
import { PartialObserver } from 'rxjs';
import { CentrifugeLiveChannel } from './channel';

describe('grafana live channel', () => {
  it('accuratly counts the active observers', () => {
    const chan = new CentrifugeLiveChannel('a/b/c', {} as LiveChannelAddress);
    const noop: PartialObserver<LiveChannelEvent> = {
      next: v => {},
    };

    expect(chan.getObserverCount()).toEqual(0);

    const subA = chan.getStream().subscribe(noop);
    expect(chan.getObserverCount()).toEqual(1);
    const subB = chan.getStream().subscribe(noop);
    expect(chan.getObserverCount()).toEqual(2);

    subA.unsubscribe();
    subB.unsubscribe();

    expect(chan.getObserverCount()).toEqual(0);
  });
});
