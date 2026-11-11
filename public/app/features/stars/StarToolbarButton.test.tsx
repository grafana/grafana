import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { type GrafanaConfig, locationUtil } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setBackendSrv, setStarsSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { getFolderFixtures } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

import { StarToolbarButton } from './StarToolbarButton';
import { itemStarred } from './analytics/main';
import { CollectionsStarsSrv } from './service';

jest.mock('./analytics/main', () => ({
  itemStarred: jest.fn(),
}));

const [_, { dashbdD, folderA, folderA_folderB_dashbdB }] = getFolderFixtures();

setBackendSrv(backendSrv);
// Stars go through the runtime service, which refuses signed-out callers
setStarsSrv(new CollectionsStarsSrv());
contextSrv.isSignedIn = true;
setupMockServer();
locationUtil.initialize({
  config: { appSubUrl: '/foo/bar' } as GrafanaConfig,
  getTimeRangeForUrl: jest.fn(),
  getVariablesUrlParams: jest.fn(),
});

const existingStarredItem = dashbdD.item;
const itemToStar = folderA_folderB_dashbdB.item;
const folderToStar = folderA.item;

const findStarButton = (title: string, isStarred: boolean) =>
  screen.findByRole('button', { name: new RegExp(`^${isStarred ? 'unmark' : 'mark'} "${title}" as favorite`, 'i') });

const setup = (
  itemForStarButton: typeof existingStarredItem | typeof itemToStar,
  { group = 'dashboard.grafana.app', kind = 'Dashboard' } = {}
) => render(<StarToolbarButton title={itemForStarButton.title} group={group} kind={kind} id={itemForStarButton.uid} />);

describe('StarToolbarButton', () => {
  beforeEach(() => {
    jest.mocked(itemStarred).mockClear();
  });

  it('stars and unstars the item', async () => {
    const { user } = setup(itemToStar);

    await user.click(await findStarButton(itemToStar.title, false));
    expect(await findStarButton(itemToStar.title, true)).toBeInTheDocument();

    await user.click(await findStarButton(itemToStar.title, true));
    expect(await findStarButton(itemToStar.title, false)).toBeInTheDocument();
  });

  it('shows spinner initially and transitions to empty star when loading completes with no starred items', async () => {
    setup(itemToStar);
    const button = screen.getByTestId(selectors.components.NavToolbar.markAsFavorite);

    // Initially, button should be disabled (loading state)
    expect(button).toBeDisabled();

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 3000 }
    );

    // After loading, should show "Mark as favorite" (empty star state)
    expect(await findStarButton(itemToStar.title, false)).toBeInTheDocument();
  });

  it('shows spinner initially and transitions to filled star when loading completes with starred item', async () => {
    setup(existingStarredItem);
    const button = screen.getByTestId(selectors.components.NavToolbar.markAsFavorite);

    // Initially, button should be disabled (loading state)
    expect(button).toBeDisabled();

    // Wait for loading to complete
    await waitFor(
      () => {
        expect(button).not.toBeDisabled();
      },
      { timeout: 3000 }
    );

    // After loading, should show "Unmark as favorite" (filled star state)
    expect(await findStarButton(existingStarredItem.title, true)).toBeInTheDocument();
  });

  it('reports a typed analytics event when starring a folder', async () => {
    const { user } = setup(folderToStar, { group: 'folder.grafana.app', kind: 'Folder' });

    await user.click(await findStarButton(folderToStar.title, false));

    await waitFor(() => {
      expect(itemStarred).toHaveBeenCalledWith({
        group: 'folder.grafana.app',
        kind: 'Folder',
        status: 'starred',
        origin: 'StarToolbarButton',
      });
    });
    expect(itemStarred).toHaveBeenCalledTimes(1);
  });

  it('reports no analytics event when the star is not stored', async () => {
    server.use(
      http.put(
        '/apis/collections.grafana.app/v1alpha1/namespaces/:namespace/stars/:name/update/:group/:kind/:id',
        () => new HttpResponse(null, { status: 500 })
      )
    );
    const { user } = render(
      <StarToolbarButton title={itemToStar.title} group="dashboard.grafana.app" kind="Dashboard" id={itemToStar.uid} />
    );

    await user.click(await findStarButton(itemToStar.title, false));

    expect(await findStarButton(itemToStar.title, false)).toBeInTheDocument();
    expect(itemStarred).not.toHaveBeenCalled();
  });

  it('reports a typed analytics event when unstarring a dashboard', async () => {
    const { user } = setup(existingStarredItem);

    await user.click(await findStarButton(existingStarredItem.title, true));

    await waitFor(() => {
      expect(itemStarred).toHaveBeenCalledWith({
        group: 'dashboard.grafana.app',
        kind: 'Dashboard',
        status: 'unstarred',
        origin: 'StarToolbarButton',
      });
    });
    expect(itemStarred).toHaveBeenCalledTimes(1);
  });
});
