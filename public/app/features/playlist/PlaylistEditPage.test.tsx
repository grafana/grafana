import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import { useResourceRepositorySelection } from 'app/features/provisioning/hooks/useResourceRepositorySelection';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';

import { PlaylistEditPage } from './PlaylistEditPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

jest.mock('app/features/provisioning/hooks/useResourceRepositorySelection');
const mockUseResourceRepositorySelection = useResourceRepositorySelection as jest.MockedFunction<
  typeof useResourceRepositorySelection
>;

async function getTestContext(
  annotations?: Record<string, string>,
  provisioning: ReturnType<typeof useResourceRepositorySelection> = { isAvailable: false, repositories: [] }
) {
  jest.clearAllMocks();
  mockUseResourceRepositorySelection.mockReturnValue(provisioning);

  const backendSrvMock = jest.spyOn(backendSrv, 'fetch').mockImplementation(() =>
    of(
      createFetchResponse({
        apiVersion: 'playlist.grafana.app/v0alpha1',
        kind: 'Playlist',
        spec: {
          title: 'Test Playlist',
          interval: '5s',
          items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
        },
        metadata: {
          name: 'foo',
          ...(annotations ? { annotations } : {}),
        },
      })
    )
  );

  const { rerender } = render(
    <TestProvider>
      <PlaylistEditPage />
    </TestProvider>
  );
  return { rerender, backendSrvMock };
}

describe('PlaylistEditPage', () => {
  describe('when mounted', () => {
    it('then it should load playlist and header should be correct', async () => {
      await getTestContext();

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(await screen.findByRole('textbox', { name: /name/i })).toHaveValue('Test Playlist');
      expect(screen.getByRole('textbox', { name: /interval/i })).toHaveValue('5s');
      expect(screen.getAllByRole('row')).toHaveLength(1);
    });

    it('then it should not render the provisioned badge for an unmanaged playlist', async () => {
      await getTestContext();

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
    });

    it('then it should render the provisioned badge for a managed playlist', async () => {
      await getTestContext({
        'grafana.app/managedBy': 'repo',
        'grafana.app/managerId': 'foo-repo',
      });

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
    });
  });

  describe('when submitted', () => {
    it('then correct api should be called', async () => {
      const { backendSrvMock } = await getTestContext();

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(locationService.getLocation().pathname).toEqual('/');
      await userEvent.clear(await screen.findByRole('textbox', { name: /name/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'A Name');
      await userEvent.clear(await screen.findByRole('textbox', { name: /interval/i }));
      await userEvent.type(screen.getByRole('textbox', { name: /interval/i }), '10s');
      fireEvent.submit(screen.getByRole('button', { name: /save/i }));
      await waitFor(() =>
        expect(backendSrvMock).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              spec: {
                title: 'A Name',
                interval: '10s',
                items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
              },
              metadata: {
                name: 'foo',
              },
            }),
            method: 'PUT',
          })
        )
      );
      expect(locationService.getLocation().pathname).toEqual('/playlists');
    });

    it('opens the provisioning save drawer for a repository-managed playlist instead of calling the API', async () => {
      const { backendSrvMock } = await getTestContext({
        'grafana.app/managedBy': 'repo',
        'grafana.app/managerId': 'test-repo',
        'grafana.app/sourcePath': 'playlists/foo.json',
      });

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      const saveButton = await screen.findByRole('button', { name: /save/i });
      backendSrvMock.mockClear();

      fireEvent.submit(saveButton);

      // The provisioning save drawer opens...
      expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
      // ...and the playlist replace API is not called.
      expect(backendSrvMock).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
    });
  });

  describe('repository field', () => {
    const repositories = [
      { name: 'test-repo', title: 'Test Repository', target: 'instance' as const, type: 'git' as const, workflows: [] },
    ];

    it('shows the (read-only) repository field for a repository-managed playlist', async () => {
      await getTestContext(
        {
          'grafana.app/managedBy': 'repo',
          'grafana.app/managerId': 'test-repo',
          'grafana.app/sourcePath': 'playlists/foo.json',
        },
        { isAvailable: true, repositories }
      );

      expect(await screen.findByText('Repository')).toBeInTheDocument();
    });

    it('does not show the repository field for an unmanaged playlist stored in Grafana', async () => {
      await getTestContext(undefined, { isAvailable: true, repositories });

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(screen.queryByText('Repository')).not.toBeInTheDocument();
    });
  });
});
