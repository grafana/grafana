import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { TestProvider } from 'test/helpers/TestProvider';

import { locationService } from '@grafana/runtime';

import { createFetchResponse } from '../../../test/helpers/createFetchResponse';
import { backendSrv } from '../../core/services/backend_srv';
import { useResourceRepositorySelection } from '../provisioning/hooks/useResourceRepositorySelection';

import { PlaylistNewPage } from './PlaylistNewPage';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
}));

jest.mock('../provisioning/hooks/useResourceRepositorySelection');

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

const mockUseResourceRepositorySelection = useResourceRepositorySelection as jest.MockedFunction<
  typeof useResourceRepositorySelection
>;

function getTestContext(
  provisioning: ReturnType<typeof useResourceRepositorySelection> = { isAvailable: false, repositories: [] }
) {
  jest.clearAllMocks();
  // Provisioning unavailable by default, so the repository selector is hidden.
  mockUseResourceRepositorySelection.mockReturnValue(provisioning);

  // Create separate spies for different HTTP methods
  const postSpy = jest.fn();
  const otherSpy = jest.fn();

  const backendSrvMock = jest.spyOn(backendSrv, 'fetch').mockImplementation((options) => {
    if (options.method === 'POST') {
      postSpy(options);
      return of(createFetchResponse({}));
    }
    // Handle GET and other methods
    otherSpy(options);
    return of(createFetchResponse({ items: [] }));
  });

  jest.spyOn(backendSrv, 'search').mockResolvedValue([]);

  const { rerender } = render(
    <TestProvider>
      <PlaylistNewPage />
    </TestProvider>
  );

  return { rerender, backendSrvMock, postSpy, otherSpy };
}

describe('PlaylistNewPage', () => {
  describe('when mounted', () => {
    it('then header should be correct', async () => {
      getTestContext();

      expect(await screen.findByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
    });
  });

  describe('when submitted', () => {
    it('then correct api should be called', async () => {
      const { postSpy } = getTestContext();

      expect(locationService.getLocation().pathname).toEqual('/');

      await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'A new name');
      await userEvent.clear(screen.getByRole('textbox', { name: 'Interval' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Interval' }), '10m');
      fireEvent.submit(screen.getByRole('button', { name: /save/i }));
      await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));

      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            spec: {
              title: 'A new name',
              interval: '10m',
              items: [],
            },
          }),
        })
      );
      await waitFor(() => {
        expect(locationService.getLocation().pathname).toEqual('/playlists');
      });
    });
  });

  describe('repository selector', () => {
    const repositories = [
      { name: 'test-repo', title: 'Test Repository', target: 'instance' as const, type: 'git' as const, workflows: [] },
    ];

    it('is not shown when provisioning is unavailable', async () => {
      getTestContext();

      expect(await screen.findByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
      expect(screen.queryByText('Repository')).not.toBeInTheDocument();
    });

    it('is shown when provisioning is available', async () => {
      getTestContext({ isAvailable: true, repositories });

      expect(await screen.findByText('Repository')).toBeInTheDocument();
    });

    it('is not shown when no repositories are configured', async () => {
      // The hook reports isAvailable=false when there are no repositories, so the selector is hidden.
      getTestContext({ isAvailable: false, repositories: [] });

      expect(await screen.findByRole('heading', { name: /new playlist/i })).toBeInTheDocument();
      expect(screen.queryByText('Repository')).not.toBeInTheDocument();
    });

    it('opens the provisioning save drawer instead of creating directly once a repository is selected', async () => {
      const { postSpy } = getTestContext({ isAvailable: true, repositories });

      await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Repo Playlist');
      // Select the (only) repository. No selection = stored in Grafana (a cleared placeholder, not a
      // literal row), so ArrowDown highlights the first repo. Options are virtualized in jsdom and
      // not reliably queryable, but downshift still tracks the highlighted index.
      const combobox = await screen.findByRole('combobox', { name: /repository/i });
      await userEvent.click(combobox);
      await userEvent.keyboard('{ArrowDown}{Enter}');

      fireEvent.submit(screen.getByRole('button', { name: /save/i }));

      // The provisioning save drawer opens...
      expect(await screen.findByRole('heading', { name: /save provisioned playlist/i })).toBeInTheDocument();
      // ...and the playlist is not created directly through the playlist API.
      expect(postSpy).not.toHaveBeenCalled();
    });
  });
});
