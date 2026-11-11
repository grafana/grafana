import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from 'test/test-utils';

import { setBackendSrv } from '@grafana/runtime';
import { UserStorage } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { backendSrv } from 'app/core/services/backend_srv';

import { HomePagePickerModal } from './HomePagePicker';
import { HOME_PAGE_STORAGE_KEY, HOME_PAGE_STORAGE_SERVICE } from './useHomePageChoice';

const CATALOG_URL = '/api/plugins/grafana-assistant-app/resources/api/v1/page-catalog';
const storage = () => new UserStorage(HOME_PAGE_STORAGE_SERVICE);

setBackendSrv(backendSrv);
setupMockServer();
mockComboboxRect();

describe('HomePagePickerModal', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('clears the chosen page to go back to the default homepage', async () => {
    await storage().setItem(HOME_PAGE_STORAGE_KEY, '6463a7ebb3cb');
    const onDismiss = jest.fn();
    const { user } = render(<HomePagePickerModal onDismiss={onDismiss} />);

    await user.click(await screen.findByRole('button', { name: 'Use the default homepage' }));

    await waitFor(() => expect(onDismiss).toHaveBeenCalled());
    expect(await storage().getItem(HOME_PAGE_STORAGE_KEY)).toBeNull();
  });

  it('offers no reset when no page is set as home', async () => {
    render(<HomePagePickerModal onDismiss={jest.fn()} />);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use the default homepage' })).not.toBeInTheDocument();
  });

  describe('finding a page', () => {
    const shared = { id: 'shared-111111111111', title: 'Shared in a folder' };
    const own = { id: 'own-222222222222', title: 'Hello Jeff, your goals today' };

    beforeEach(() => {
      server.use(
        http.get(CATALOG_URL, ({ request }) => {
          const params = new URL(request.url).searchParams;
          // Search text matches nothing, so a pasted link can only be found through its own lookup
          const pages = params.has('search')
            ? []
            : ({ discover: [shared], mine: [own], unlisted: [own] }[params.get('section') ?? ''] ?? []);
          return HttpResponse.json({ data: { pages } });
        }),
        http.get(`${CATALOG_URL}/:ref`, ({ params }) =>
          params.ref === 'hello-jeff-12eb0562bec0'
            ? HttpResponse.json({ data: { page: own } })
            : HttpResponse.json({ message: 'not found' }, { status: 404 })
        )
      );
    });

    it("lists the user's own pages next to shared ones, once each", async () => {
      const { user } = render(<HomePagePickerModal onDismiss={jest.fn()} />);

      await user.click(await screen.findByRole('combobox'));

      expect(await screen.findAllByRole('option')).toHaveLength(2);
      expect(screen.getByRole('option', { name: /Hello Jeff/ })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Shared in a folder/ })).toBeInTheDocument();
    });

    it('saves the page a pasted link points at', async () => {
      const { user } = render(<HomePagePickerModal onDismiss={jest.fn()} />);

      const combobox = await screen.findByRole('combobox');
      await user.click(combobox);
      await user.type(combobox, `${window.location.origin}/a/grafana-assistant-app/pages/hello-jeff-12eb0562bec0`);
      await user.click(await screen.findByRole('option', { name: /Hello Jeff/ }));
      await user.click(screen.getByRole('button', { name: 'Set as home' }));

      await waitFor(async () => expect(await storage().getItem(HOME_PAGE_STORAGE_KEY)).toBe(own.id));
    });
  });
});
