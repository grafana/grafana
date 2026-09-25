import { toDataQueryError } from './toDataQueryError';

describe('toDataQueryError', () => {
  it('turns a string into a message', () => {
    expect(toDataQueryError('something broke')).toEqual({ message: 'something broke' });
  });

  it('keeps an existing message', () => {
    const err = { message: 'already set', status: 500 };
    expect(toDataQueryError(err)).toBe(err);
  });

  it('builds a message from the response status', () => {
    expect(toDataQueryError({ status: 500, statusText: 'Internal Server Error' }).message).toBe(
      'Query error: 500 Internal Server Error'
    );
  });

  it('prefers the message from the response data', () => {
    expect(toDataQueryError({ status: 400, data: { message: 'bad query' } }).message).toBe('bad query');
  });

  it('attaches the message to the object it was given', () => {
    const err = { status: 500, statusText: 'Internal Server Error' };
    expect(toDataQueryError(err)).toBe(err);
  });

  describe('when the error cannot be changed', () => {
    // Errors that have been through the Redux store are frozen by immer, so writing to them throws.
    it('does not throw on a frozen object', () => {
      const err = Object.freeze({ status: 500, statusText: 'Internal Server Error' });

      const result = toDataQueryError(err);

      expect(result.message).toBe('Query error: 500 Internal Server Error');
      expect(result).not.toBe(err);
      expect(result.status).toBe(500);
      expect(err).toEqual({ status: 500, statusText: 'Internal Server Error' });
    });

    it('does not throw on a sealed object', () => {
      const err = Object.seal({ status: 502, statusText: 'Bad Gateway' });
      expect(toDataQueryError(err).message).toBe('Query error: 502 Bad Gateway');
    });

    it('does not throw on a non-extensible object', () => {
      const err = Object.preventExtensions({ data: { message: 'bad query' } });
      expect(toDataQueryError(err).message).toBe('bad query');
    });

    // Primitives are never extensible, so they take the copy path too.
    it('does not throw on a thrown primitive', () => {
      expect(toDataQueryError(500).message).toBe('Query error');
      expect(toDataQueryError(true).message).toBe('Query error');
    });

    it('keeps the stack of a frozen Error', () => {
      const err = new Error();
      err.stack = 'a stack trace';
      Object.freeze(err);

      const result = toDataQueryError(err);

      expect(result.message).toBe('Query error');
      expect((result as { stack?: string }).stack).toBe('a stack trace');
    });
  });
});
