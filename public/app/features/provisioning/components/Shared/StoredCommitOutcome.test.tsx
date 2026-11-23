import { act, render, screen, waitFor } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';

import { COMMIT_OUTCOME_STORAGE_KEY } from '../../constants';

import { StoredCommitOutcome } from './StoredCommitOutcome';

function storedOutcome(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    action: 'update',
    configuredBranch: 'main',
    repoType: 'github',
    kindLabel: 'playlist',
    path: '/playlists',
    ...overrides,
  });
}

function setup(stored: string) {
  window.sessionStorage.setItem(COMMIT_OUTCOME_STORAGE_KEY, stored);
  return render(<StoredCommitOutcome />, { historyOptions: { initialEntries: ['/playlists'] } });
}

describe('StoredCommitOutcome', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('reopens the outcome of a commit on the page it was made on', async () => {
    setup(storedOutcome());

    expect(await screen.findByText(/committed to main/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Save provisioned playlist' })).toBeInTheDocument();
  });

  it.each([
    ['a malformed record', 'not json'],
    ['an unknown action', storedOutcome({ action: 'rename' })],
    ['a record without a kind', storedOutcome({ kindLabel: undefined })],
    ['a record from another page', storedOutcome({ path: '/dashboards' })],
  ])('drops %s without opening the drawer', async (_, stored) => {
    setup(stored);

    await waitFor(() => expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).toBeNull());
    expect(screen.queryByText(/committed to/i)).not.toBeInTheDocument();
  });

  it('drops the record when the drawer closes', async () => {
    const { user } = setup(storedOutcome());

    await user.click(await screen.findByTestId(selectors.components.Drawer.General.close));

    expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).toBeNull();
    expect(screen.queryByText(/committed to main/i)).not.toBeInTheDocument();
  });

  it('opens the redirect page when the drawer closes', async () => {
    const { user } = setup(storedOutcome({ redirectUrl: '/playlists/list' }));

    await user.click(await screen.findByTestId(selectors.components.Drawer.General.close));

    expect(locationService.getLocation().pathname).toBe('/playlists/list');
  });

  it('drops the record when the user leaves the page', async () => {
    setup(storedOutcome());
    expect(await screen.findByText(/committed to main/i)).toBeInTheDocument();

    act(() => locationService.push('/dashboards'));

    await waitFor(() => expect(screen.queryByText(/committed to main/i)).not.toBeInTheDocument());
    expect(window.sessionStorage.getItem(COMMIT_OUTCOME_STORAGE_KEY)).toBeNull();
    act(() => locationService.push('/playlists'));
    expect(screen.queryByText(/committed to main/i)).not.toBeInTheDocument();
  });
});
