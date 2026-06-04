import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  AnnoKeyManagerAllowsEdits,
  AnnoKeyManagerIdentity,
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  ManagerKind,
} from 'app/features/apiserver/types';

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

async function getTestContext() {
  jest.clearAllMocks();

  const backendSrvMock = jest.spyOn(backendSrv, 'fetch').mockImplementation(() =>
    of(
      createFetchResponse({
        spec: {
          title: 'Test Playlist',
          interval: '5s',
          items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
        },
        metadata: {
          name: 'foo',
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

function renderWithMetadata(metadata: object) {
  jest.clearAllMocks();
  jest.spyOn(backendSrv, 'fetch').mockImplementation(() =>
    of(
      createFetchResponse({
        spec: {
          title: 'Test Playlist',
          interval: '5s',
          items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
        },
        metadata,
      })
    )
  );

  return render(
    <TestProvider>
      <PlaylistEditPage />
    </TestProvider>
  );
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
  });

  describe('when the playlist is repository-managed', () => {
    it('opens the save drawer instead of calling the playlist API', async () => {
      jest.clearAllMocks();
      const backendSrvMock = jest.spyOn(backendSrv, 'fetch').mockImplementation(() =>
        of(
          createFetchResponse({
            spec: {
              title: 'Test Playlist',
              interval: '5s',
              items: [{ title: 'First item', type: 'dashboard_by_uid', order: 1, value: '1' }],
            },
            metadata: {
              name: 'foo',
              annotations: {
                [AnnoKeyManagerKind]: ManagerKind.Repo,
                [AnnoKeyManagerIdentity]: 'test-repo',
                [AnnoKeySourcePath]: 'playlists/foo.json',
              },
            },
          })
        )
      );

      render(
        <TestProvider>
          <PlaylistEditPage />
        </TestProvider>
      );

      expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
      backendSrvMock.mockClear();

      fireEvent.submit(screen.getByRole('button', { name: /save/i }));

      // The provisioning save drawer opens...
      expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
      // ...and the playlist replace API is not called.
      expect(backendSrvMock).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
    });
  });

  describe('managed badges', () => {
    it('does not show managed badges for an unmanaged playlist', async () => {
      renderWithMetadata({ name: 'foo' });

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      expect(screen.queryByTestId('icon-exchange-alt')).not.toBeInTheDocument();
      expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    });

    it('shows the managed badge for a managed playlist', async () => {
      renderWithMetadata({ name: 'foo', annotations: { [AnnoKeyManagerKind]: ManagerKind.Repo } });

      expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
      expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    });

    it('shows the read-only badge for a managed playlist that does not allow edits', async () => {
      renderWithMetadata({ name: 'foo', annotations: { [AnnoKeyManagerKind]: ManagerKind.Terraform } });

      expect(await screen.findByText('Read only')).toBeInTheDocument();
      expect(screen.getByTestId('icon-exchange-alt')).toBeInTheDocument();
    });

    it('does not show the read-only badge when the manager allows edits', async () => {
      renderWithMetadata({
        name: 'foo',
        annotations: { [AnnoKeyManagerKind]: ManagerKind.Terraform, [AnnoKeyManagerAllowsEdits]: 'true' },
      });

      expect(await screen.findByTestId('icon-exchange-alt')).toBeInTheDocument();
      expect(screen.queryByText('Read only')).not.toBeInTheDocument();
    });
  });
});
