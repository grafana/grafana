import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import {
  getPlaylistCustomViewChannelName,
  PLAYLIST_CUSTOM_VIEW_MESSAGE,
  PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM,
} from 'app/features/playlist/customView';

import { DashboardPlaylistViewBanner } from './DashboardPlaylistViewBanner';

describe('DashboardPlaylistViewBanner', () => {
  const postMessage = jest.fn();
  const closeChannel = jest.fn();
  const originalBroadcastChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
  const BroadcastChannelMock = jest.fn().mockImplementation(() => ({ postMessage, close: closeChannel }));

  beforeEach(() => {
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: BroadcastChannelMock,
    });
    jest.spyOn(window, 'close').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    postMessage.mockClear();
    closeChannel.mockClear();
    BroadcastChannelMock.mockClear();
    if (originalBroadcastChannel) {
      Object.defineProperty(globalThis, 'BroadcastChannel', originalBroadcastChannel);
    }
  });

  it('returns the current dashboard state to the playlist editor', async () => {
    const { user } = render(<DashboardPlaylistViewBanner />, {
      historyOptions: {
        initialEntries: [`/d/uid/name?var-host=prod&from=now-6h&to=now&${PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM}=token-1`],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Use this view' }));

    expect(BroadcastChannelMock).toHaveBeenCalledWith(getPlaylistCustomViewChannelName('token-1'));
    expect(postMessage).toHaveBeenCalledWith({
      type: PLAYLIST_CUSTOM_VIEW_MESSAGE,
      token: 'token-1',
      queryString: 'var-host=prod&from=now-6h&to=now',
    });
    expect(closeChannel).toHaveBeenCalled();
    expect(window.close).toHaveBeenCalled();
  });

  it('does not render outside playlist configuration mode', () => {
    render(<DashboardPlaylistViewBanner />, {
      historyOptions: { initialEntries: ['/d/uid/name?var-host=prod'] },
    });

    expect(screen.queryByText('Configuring playlist custom view')).not.toBeInTheDocument();
  });
});
