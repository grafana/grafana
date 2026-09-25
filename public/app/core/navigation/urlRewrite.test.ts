import { isUrlRewrite, markAsUrlRewrite } from './urlRewrite';

describe('markAsUrlRewrite', () => {
  it('parses string paths and attaches the flag', () => {
    const descriptor = markAsUrlRewrite('/d/abc/my-dash?orgId=1');

    expect(descriptor.pathname).toBe('/d/abc/my-dash');
    expect(descriptor.search).toBe('?orgId=1');
    expect(isUrlRewrite(descriptor.state)).toBe(true);
  });

  it('preserves existing state on location descriptors', () => {
    const descriptor = markAsUrlRewrite({ pathname: '/d/abc/my-dash', state: { returnTo: '/prev' } });

    expect(descriptor.state).toEqual({ returnTo: '/prev', urlRewrite: true });
  });
});

describe('isUrlRewrite', () => {
  it.each([undefined, null, 'string', {}, { urlRewrite: false }, { urlRewrite: 'true' }])(
    'is false for unflagged state %p',
    (state) => {
      expect(isUrlRewrite(state)).toBe(false);
    }
  );
});
