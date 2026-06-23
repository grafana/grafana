import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';
import {
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

async function getTestContext(annotations?: Record<string, string>) {
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

      expect(await screen.findByRole('heading', { name: /edit playlist/i })).toBeInTheDocument();
      // Wait for the form (rendered once the playlist data loads) before submitting.
      const saveButton = await screen.findByRole('button', { name: /save/i });
      backendSrvMock.mockClear();

      fireEvent.submit(saveButton);

      // The provisioning save drawer opens...
      expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
      // ...and the playlist replace API is not called.
      expect(backendSrvMock).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT' }));
    });
  });
});
