import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/services/context_srv';

import { type Playlist } from '../../api/clients/playlist/v1';

import { PlaylistCard } from './PlaylistCard';

function getPlaylist(annotations?: Record<string, string>): Playlist {
  return {
    apiVersion: 'playlist.grafana.app/v1',
    kind: 'Playlist',
    metadata: {
      name: 'foo',
      ...(annotations ? { annotations } : {}),
    },
    spec: {
      title: 'Test Playlist',
      interval: '5m',
      items: [],
    },
  };
}

function setup(playlist: Playlist) {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  return render(
    <TestProvider>
      <PlaylistCard playlist={playlist} setStartPlaylist={jest.fn()} setPlaylistToDelete={jest.fn()} />
    </TestProvider>
  );
}

describe('PlaylistCard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not render the provisioned badge for an unmanaged playlist', () => {
    setup(getPlaylist());

    expect(screen.getByText('Test Playlist')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
  });

  it('renders the provisioned badge for a managed playlist', () => {
    setup(
      getPlaylist({
        'grafana.app/managedBy': 'repo',
        'grafana.app/managerId': 'foo-repo',
      })
    );

    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });
});
