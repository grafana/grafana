import { configureStore } from '@reduxjs/toolkit';
import { HttpResponse, http } from 'msw';
import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom-v5-compat';
import { type Store } from 'redux';
import { render, screen, waitFor } from 'test/test-utils';

import { generatedAPI as folderSearchAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import * as appNotification from 'app/core/copy/appNotification';
import { setStore } from 'app/store/store';
import { type StoreState } from 'app/types/store';

import { setupMswServer } from '../../mockApi';

import { LegacyRecentlyDeletedRedirect, LegacyRuleListRedirect } from './legacyRedirects';

const server = setupMswServer();

const FOLDER_SEARCH_URL = '/apis/folder.grafana.app/v1beta1/namespaces/:namespace/folders/search';

setDataSourceSrv({ getList: () => [], getInstanceSettings: () => undefined } as unknown as DataSourceSrv);

const warning = jest.fn();

jest.mock('react-router-dom-v5-compat', () => ({
  ...jest.requireActual('react-router-dom-v5-compat'),
  Navigate: jest.fn(() => null),
}));

function renderAt(initialEntry: string, element: ReactElement) {
  return render(element, { historyOptions: { initialEntries: [initialEntry] } });
}

async function waitForNavigateTarget() {
  await waitFor(() => expect(jest.mocked(Navigate)).toHaveBeenCalled());
  const calls = jest.mocked(Navigate).mock.calls;
  return calls[calls.length - 1][0].to;
}

// NAV-1: `/alerting/list` and `/alerting/recently-deleted` redirect to the GMA-only pages once
// the stack flag is on. The full migration (type-based destination choice and legacy-param
// translation) runs before navigating, so a `type:` token is consumed rather than carried
// through to the destination's canonical search.
describe('LegacyRuleListRedirect', () => {
  beforeEach(() => {
    // The folder-name lookup dispatches through the global app store, which render() does not populate.
    const store = configureStore({
      reducer: { [folderSearchAPI.reducerPath]: folderSearchAPI.reducer },
      middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(folderSearchAPI.middleware),
    });
    setStore(store as unknown as Store<StoreState>);
    warning.mockClear();
    jest.spyOn(appNotification, 'useAppNotification').mockReturnValue({
      success: jest.fn(),
      warning,
      error: jest.fn(),
      info: jest.fn(),
    });
  });

  afterEach(() => {
    jest.mocked(Navigate).mockClear();
    jest.restoreAllMocks();
  });

  it('shows a loading placeholder while the migration is in flight', async () => {
    renderAt('/alerting/list?search=cpu', <LegacyRuleListRedirect />);

    expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    expect(Navigate).not.toHaveBeenCalled();

    // Let the in-flight migration settle before the test ends, so its state update lands
    // inside this test's act() scope rather than leaking into the next one.
    await waitForNavigateTarget();
  });

  it('redirects to Recording rules and drops the type token when the legacy search has type:recording', async () => {
    renderAt('/alerting/list?search=type%3Arecording%20cpu&view=list', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/recording?search=cpu&view=list');
  });

  it('redirects to Alert rules when there is no type token', async () => {
    renderAt('/alerting/list?search=cpu', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu');
  });

  it('redirects to Alert rules and drops the type token when type is explicitly alerting', async () => {
    renderAt('/alerting/list?search=type%3Aalerting%20cpu', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu');
  });

  it('redirects to Alert rules with no query string at all', async () => {
    renderAt('/alerting/list', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert');
    expect(warning).not.toHaveBeenCalled();
  });

  // NAV-4: the redirect never fails or hangs; what cannot be migrated is removed and named.
  it.each([403, 500])(
    'NAV-4.1: still redirects, without the folder filter, and warns when the folder lookup fails with %s',
    async (status) => {
      server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ message: 'nope' }, { status })));

      renderAt('/alerting/list?search=namespace%3A%22Secret%20Team%22%20cpu', <LegacyRuleListRedirect />);

      expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu');
      await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
      expect(warning).toHaveBeenCalledWith('Some filters were removed', expect.stringContaining('namespace'));
      expect(warning.mock.calls[0].join(' ')).not.toContain('Secret Team');
    }
  );

  it('NAV-4.2: warns about a folder name that matches no folder, and redirects without it', async () => {
    server.use(http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ items: [], metadata: {} })));

    renderAt('/alerting/list?search=namespace%3AGone&view=grouped', <LegacyRuleListRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert');
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning).toHaveBeenCalledWith('Some filters were removed', expect.stringContaining('namespace'));
  });

  it('NAV-4.3: redirects and names every removed key when parameters are malformed or unknown', async () => {
    renderAt(
      '/alerting/list?search=state%3Abogus%20nonsense%3A1%20cpu%20label%3A%22unterminated&view=list',
      <LegacyRuleListRedirect />
    );

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert?search=cpu&view=list');
    await waitFor(() => expect(warning).toHaveBeenCalledTimes(1));
    expect(warning).toHaveBeenCalledWith(
      'Some filters were removed',
      'These filters could not be migrated and were removed: label, nonsense, state'
    );
  });
});

describe('LegacyRecentlyDeletedRedirect', () => {
  afterEach(() => {
    jest.mocked(Navigate).mockClear();
  });

  it('always redirects to the Alert rules Recently deleted tab', async () => {
    renderAt('/alerting/recently-deleted?foo=bar', <LegacyRecentlyDeletedRedirect />);

    expect(await waitForNavigateTarget()).toBe('/alerting/rules/alert/deleted?foo=bar');
  });
});
