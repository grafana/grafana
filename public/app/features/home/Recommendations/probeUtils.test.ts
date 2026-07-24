import { withTimeout } from './probeUtils';

describe('withTimeout', () => {
  it('resolves with the promise value when it settles inside the deadline', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('propagates a rejection that happens inside the deadline', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 50)).rejects.toThrow('boom');
  });

  it('rejects once the deadline passes while the promise hangs', async () => {
    const hang = new Promise<never>(() => {});

    await expect(withTimeout(hang, 20)).rejects.toThrow(/timed out/i);
  });
});
