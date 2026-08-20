import { transitionQueryCoauthoringSurface } from './QueryCoauthoringSurfaceState';

describe('transitionQueryCoauthoringSurface', () => {
  it('accepts lifecycle updates only from the current query identity and generation', () => {
    const current = { identity: 'prometheus:A', generation: '4', state: 'pending' as const };

    expect(
      transitionQueryCoauthoringSurface(current, 'prometheus:B', {
        generation: '4',
        state: 'ready',
      })
    ).toBe(current);
    expect(
      transitionQueryCoauthoringSurface(current, 'prometheus:A', {
        generation: '3',
        state: 'ready',
      })
    ).toBe(current);
    expect(
      transitionQueryCoauthoringSurface(current, 'prometheus:A', {
        generation: '4',
        state: 'ready',
      })
    ).toEqual({ identity: 'prometheus:A', generation: '4', state: 'ready' });
  });

  it('requires a new generation before retrying an unavailable or failed surface', () => {
    const failed = { identity: 'prometheus:A', generation: '4', state: 'failed' as const };

    expect(transitionQueryCoauthoringSurface(failed, 'prometheus:A', { generation: '4', state: 'ready' })).toBe(failed);
  });
});
