import { createShortLink, createAndCopyShortLink } from './shortLinks';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => {
    return {
      post: () => {
        return Promise.resolve({ url: 'www.short.com' });
      },
    };
  },
  config: {
    appSubUrl: '',
  },
}));

describe('createShortLink', () => {
  it('creates short link', async () => {
    const shortUrl = await createShortLink('www.verylonglinkwehavehere.com');
    expect(shortUrl).toBe('www.short.com');
  });
});

describe('createAndCopyShortLink', () => {
  it('copies short link to clipboard', async () => {
    document.execCommand = jest.fn();
    await createAndCopyShortLink('www.verylonglinkwehavehere.com');
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });
});
