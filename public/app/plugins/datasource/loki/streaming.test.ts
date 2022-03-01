import { getLiveStreamKey } from './streaming';

describe('loki streaming', () => {
  // jsdom does not have TextEncoder :_(
  it.skip('key only depends on expression', async () => {
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'X' } as any)).toEqual('80e8fddbe770');
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'Y' } as any)).toEqual('80e8fddbe770');
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'Z' } as any)).toEqual('80e8fddbe770');
  });
});
