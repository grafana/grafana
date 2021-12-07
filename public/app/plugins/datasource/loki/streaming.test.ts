import { getLiveStreamKey } from './streaming';

describe('loki streaming', () => {
  it('key only depends on expression', async () => {
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'X' } as any)).toEqual('151a6aa1417f2b12');
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'Y' } as any)).toEqual('151a6aa1417f2b12');
    expect(await getLiveStreamKey({ expr: 'hello', refId: 'Z' } as any)).toEqual('151a6aa1417f2b12');
  });
});
