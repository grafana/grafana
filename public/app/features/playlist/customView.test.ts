import {
  addPlaylistCustomViewToken,
  getPlaylistCustomViewQueryParams,
  isPlaylistCustomViewMessage,
  PLAYLIST_CUSTOM_VIEW_MESSAGE,
  PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM,
} from './customView';

describe('playlist custom view flow', () => {
  it('adds and removes the temporary configuration token', () => {
    const url = addPlaylistCustomViewToken('/d/uid/name?var-host=prod', 'token 1');

    expect(url).toBe(`/d/uid/name?var-host=prod&${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=token%201`);
    expect(getPlaylistCustomViewQueryParams(new URL(url, 'http://localhost').search)).toBe('var-host=prod');
  });

  it('recognizes messages from the dashboard configuration flow', () => {
    expect(
      isPlaylistCustomViewMessage({
        type: PLAYLIST_CUSTOM_VIEW_MESSAGE,
        token: 'token-1',
        queryParams: 'from=now-6h&to=now',
      })
    ).toBe(true);
    expect(isPlaylistCustomViewMessage({ type: PLAYLIST_CUSTOM_VIEW_MESSAGE, token: 'token-1' })).toBe(false);
  });
});
