import {
  addPlaylistCustomViewContext,
  getPlaylistCustomViewQueryString,
  isPlaylistCustomViewMessage,
  PLAYLIST_CUSTOM_VIEW_MESSAGE,
  PLAYLIST_CUSTOM_VIEW_TITLE_PARAM,
  PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM,
} from './customView';

describe('playlist custom view flow', () => {
  it('adds and removes the temporary configuration token', () => {
    const url = addPlaylistCustomViewContext('/d/uid/name?var-host=prod', 'token 1', 'Operations rotation');

    expect(url).toBe(
      `/d/uid/name?var-host=prod&${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=token+1&${PLAYLIST_CUSTOM_VIEW_TITLE_PARAM}=Operations+rotation`
    );
    expect(getPlaylistCustomViewQueryString(new URL(url, 'http://localhost').search)).toBe('var-host=prod');
  });

  it('replaces an existing token and keeps the URL fragment at the end', () => {
    const url = addPlaylistCustomViewContext(
      `/d/uid/name?${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=old&var-host=prod#panel-2`,
      'new token'
    );

    expect(url).toBe(`/d/uid/name?${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=new+token&var-host=prod#panel-2`);
  });

  it('recognizes messages from the dashboard configuration flow', () => {
    expect(
      isPlaylistCustomViewMessage({
        type: PLAYLIST_CUSTOM_VIEW_MESSAGE,
        token: 'token-1',
        queryString: 'from=now-6h&to=now',
      })
    ).toBe(true);
    expect(isPlaylistCustomViewMessage({ type: PLAYLIST_CUSTOM_VIEW_MESSAGE, token: 'token-1' })).toBe(false);
  });
});
