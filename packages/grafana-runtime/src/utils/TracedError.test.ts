import { TracedError } from './TracedError';

describe('TracedError', () => {
  it('uses the passed message as its own message', () => {
    const error = new TracedError('something descriptive failed', new Error('boom'));

    expect(error.message).toBe('something descriptive failed');
    expect(error.name).toBe('TracedError');
    expect(error).toBeInstanceOf(Error);
  });

  it('stores the original error on cause', () => {
    const cause = new Error('boom');
    const error = new TracedError('something descriptive failed', cause);

    expect(error.cause).toBe(cause);
  });

  it("preserves the original error's stack so the real failure location is reported", () => {
    const cause = new Error('boom');
    const error = new TracedError('something descriptive failed', cause);

    expect(error.stack).toBe(cause.stack);
  });

  it('handles a non-Error cause without copying a stack', () => {
    const error = new TracedError('something descriptive failed', 'string failure');

    expect(error.cause).toBe('string failure');
    // No cause stack to copy, so it keeps its own.
    expect(error.stack).toContain('something descriptive failed');
  });
});
