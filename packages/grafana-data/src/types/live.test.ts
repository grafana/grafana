import { isValidLiveChannelAddress, LiveChannelScope, parseLiveChannelAddress, toLiveChannelId } from './live';

describe('channels', () => {
  it('parse simple address', () => {
    const addr = parseLiveChannelAddress('plugin/testdata/random-flakey-stream');
    expect(addr?.scope).toBe(LiveChannelScope.Plugin);
    expect(addr?.stream).toBe('testdata');
    expect(addr?.path).toBe('random-flakey-stream');
  });

  it('parse support full path', () => {
    const addr = parseLiveChannelAddress('plugin/testdata/a/b/c/d   ');
    expect(addr?.scope).toBe(LiveChannelScope.Plugin);
    expect(addr?.stream).toBe('testdata');
    expect(addr?.path).toBe('a/b/c/d');
  });

  it('toLiveChannelId', () => {
    expect(
      toLiveChannelId({
        scope: LiveChannelScope.DataSource,
        stream: 'xxx',
        path: 'yyy',
      })
    ).toEqual('ds/xxx/yyy');
    expect(
      toLiveChannelId({
        scope: LiveChannelScope.DataSource,
        namespace: 'xxx', // convert to stream
        path: 'yyy',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).toEqual('ds/xxx/yyy');
    expect(
      toLiveChannelId({
        scope: LiveChannelScope.Plugin,
        stream: '', // convert to stream
        path: '',
      })
    ).toEqual('plugin');
  });

  it('isValidLiveChannelAddress', () => {
    expect(
      isValidLiveChannelAddress({
        scope: LiveChannelScope.DataSource,
        namespace: 'xxx', // convert to stream
        path: 'yyy',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    ).toBeTruthy();

    const addr = {
      scope: LiveChannelScope.DataSource,
      namespace: 'xxx', // convert to stream
      path: 'yyy',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    expect(isValidLiveChannelAddress(addr)).toBeTruthy();
    expect(addr.stream).toBe('xxx'); // mutates the input
  });
});
