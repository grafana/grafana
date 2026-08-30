import { type FetchError } from '@grafana/runtime';

import { getErrorMessage } from './ReceiverForm';

describe('getErrorMessage', () => {
  it('returns the OnCall detail when the error is an OnCall fetch error', () => {
    const error: FetchError<{ detail: string }> = {
      status: 400,
      config: { url: '' },
      data: { detail: 'integration token expired' },
    };

    expect(getErrorMessage(error)).toBe('integration token expired');
  });

  it('falls through to stringifyErrorLike for non-OnCall errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
  });
});
