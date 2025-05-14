import { FetchError } from '@grafana/runtime';

import { UNKNOW_ERROR, messageFromError } from './redux';

describe('messageFromError method', () => {
  it('should return UNKNOW_ERROR message when error is an object and not having neither in the e.data.message and nor in e.message', () => {
    const error: FetchError = {
      config: {
        url: '',
      },
      data: { message: '', error: '', response: '' },
      status: 502,
      statusText: '',
    };

    expect(messageFromError(error)).toBe(UNKNOW_ERROR);
  });
  it('should return correct message in case of having message info in the e object (in e.data.message or in e.message)', () => {
    const error: FetchError = {
      config: {
        url: '',
      },
      data: { message: 'BLA BLA', error: 'this is the error', response: '' },
      status: 502,
      statusText: 'BLu BLu',
    };
    expect(messageFromError(error)).toBe('BLA BLA; this is the error');

    const error2: Error = {
      name: 'bla bla',
      message: 'THIS IS THE MESSAGE ERROR',
    };
    expect(messageFromError(error2)).toBe('THIS IS THE MESSAGE ERROR');
  });
});
