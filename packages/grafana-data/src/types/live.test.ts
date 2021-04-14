import { LiveChannelScope, parseLiveChannelAddress } from './live';

describe('parse address', () => {
  it('simple address', () => {
    const addr = parseLiveChannelAddress('plugin/testdata/random-flakey-stream');
    expect(addr?.scope).toBe(LiveChannelScope.Plugin);
    expect(addr?.namespace).toBe('testdata');
    expect(addr?.path).toBe('random-flakey-stream');
  });

  it('suppors full path', () => {
    const addr = parseLiveChannelAddress('plugin/testdata/a/b/c/d   ');
    expect(addr?.scope).toBe(LiveChannelScope.Plugin);
    expect(addr?.namespace).toBe('testdata');
    expect(addr?.path).toBe('a/b/c/d');
  });
});
