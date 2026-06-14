import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';

import { config } from '@grafana/runtime';
import { type Playlist } from 'app/api/clients/playlist/v1';
import { contextSrv } from 'app/core/services/context_srv';
import { AnnoKeyManagerAllowsEdits, AnnoKeyManagerKind, ManagerKind } from 'app/features/apiserver/types';

import { PlaylistCard } from './PlaylistCard';

function setup(playlist: Playlist) {
  return render(
    <TestProvider>
      <PlaylistCard playlist={playlist} setStartPlaylist={jest.fn()} setPlaylistToDelete={jest.fn()} />
    </TestProvider>
  );
}

function makePlaylist(annotations?: Record<string, string>): Playlist {
  return {
    apiVersion: 'playlist.grafana.app/v1',
    kind: 'Playlist',
    metadata: { name: 'foo', annotations },
    spec: { title: 'My playlist', interval: '5m', items: [] },
  };
}

describe('PlaylistCard', () => {
  it('does not show any managed badge for an unmanaged playlist', () => {
    setup(makePlaylist());
    expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('shows the managed badge for a managed playlist', () => {
    setup(makePlaylist({ [AnnoKeyManagerKind]: ManagerKind.Repo }));
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    // repo-managed resources are not read-only (they have their own edit workflow)
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('shows the read-only badge for a managed playlist that does not allow edits', () => {
    setup(makePlaylist({ [AnnoKeyManagerKind]: ManagerKind.Terraform }));
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  it('does not show the read-only badge when the manager allows edits', () => {
    setup(makePlaylist({ [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerAllowsEdits]: 'true' }));
    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
  });

  describe('edit/delete actions', () => {
    let originalIsEditor: boolean;

    beforeEach(() => {
      config.featureToggles.playlistsRBAC = false;
      originalIsEditor = contextSrv.isEditor;
      contextSrv.isEditor = true;
    });

    afterEach(() => {
      contextSrv.isEditor = originalIsEditor;
    });

    it('disables edit and delete for a read-only playlist', () => {
      setup(makePlaylist({ [AnnoKeyManagerKind]: ManagerKind.Terraform }));
      expect(screen.getByRole('link', { name: /edit playlist/i })).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('button', { name: /delete playlist/i })).toBeDisabled();
    });

    it('keeps edit and delete enabled for an editable managed playlist', () => {
      setup(makePlaylist({ [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerAllowsEdits]: 'true' }));
      expect(screen.getByRole('link', { name: /edit playlist/i })).toHaveAttribute('aria-disabled', 'false');
      expect(screen.getByRole('button', { name: /delete playlist/i })).toBeEnabled();
    });

    it('keeps edit and delete enabled for an unmanaged playlist', () => {
      setup(makePlaylist());
      expect(screen.getByRole('link', { name: /edit playlist/i })).toHaveAttribute('aria-disabled', 'false');
      expect(screen.getByRole('button', { name: /delete playlist/i })).toBeEnabled();
    });
  });
});
