import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';

import { type Playlist } from '../../api/clients/playlist/v1';
import { backendSrv } from '../../core/services/backend_srv';

import { PlaylistForm } from './PlaylistForm';
import { PLAYLIST_CUSTOM_VIEW_MESSAGE, PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM } from './customView';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

const originalBroadcastChannel = Object.getOwnPropertyDescriptor(globalThis, 'BroadcastChannel');
const mockBroadcastChannels: Array<{
  name: string;
  onmessage: ((event: MessageEvent) => void) | null;
  close: jest.Mock;
}> = [];

const mockPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  spec: {
    title: 'A test playlist',
    interval: '10m',
    items: [
      { type: 'dashboard_by_uid', value: 'uid_1' },
      { type: 'dashboard_by_uid', value: 'uid_2' },
      { type: 'dashboard_by_tag', value: 'tag_A' },
    ],
  },
  metadata: {
    name: 'foo',
  },
  status: {},
};

const mockPerItemIntervalPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  spec: {
    title: 'A test playlist',
    interval: '10m',
    items: [
      { type: 'dashboard_by_uid', value: 'uid_1', interval: '30s' },
      { type: 'dashboard_by_uid', value: 'uid_2' },
    ],
  },
  metadata: {
    name: 'foo',
  },
  status: {},
};

const mockPerItemOptionsPlaylist: Playlist = {
  ...mockPerItemIntervalPlaylist,
  spec: {
    ...mockPerItemIntervalPlaylist.spec!,
    items: [
      {
        type: 'dashboard_by_uid',
        value: 'uid_1',
        interval: '30s',
        queryParams: 'var-host=host1&from=now-6h&to=now',
      },
      { type: 'dashboard_by_uid', value: 'uid_2', queryParams: 'var-host=host2' },
    ],
  },
};

const mockEmptyPlaylist: Playlist = {
  apiVersion: 'playlist.grafana.app/v1',
  kind: 'Playlist',
  spec: {
    title: 'A test playlist',
    interval: '10m',
    items: [],
  },
  metadata: {
    name: 'foo',
  },
  status: {},
};

function getTestContext(playlist: Playlist = mockPlaylist, dashboards: DashboardHit[] = []) {
  server.use(getCustomSearchHandler(dashboards));
  const onSubmitMock = jest.fn();
  const { rerender } = render(<PlaylistForm onSubmit={onSubmitMock} playlist={playlist} />);

  return { onSubmitMock, playlist, rerender };
}

function rows() {
  return screen.getAllByRole('row');
}

async function openItemOptions(itemValue: string) {
  const button = within(rowForItem(itemValue)).getByRole('button', { name: 'Settings' });
  if (button.getAttribute('aria-expanded') === 'false') {
    await userEvent.click(button);
  }
}

async function openDashboardLinkPaste(itemValue: string) {
  await openItemOptions(itemValue);
  const row = rowForItem(itemValue);
  if (!within(row).queryByRole('textbox', { name: new RegExp(`dashboard state for ${itemValue}`, 'i') })) {
    await userEvent.click(within(row).getByRole('button', { name: 'More custom view actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Paste link' }));
  }
}

function rowForItem(itemValue: string) {
  const cell = screen.getByRole('cell', {
    name: `Playlist item, dashboard_by_uid, ${itemValue}`,
  });
  const row = cell.closest('[role="row"]');

  if (!row) {
    throw new Error(`Could not find the row for ${itemValue}`);
  }

  return row as HTMLElement;
}

async function deleteItem(row: HTMLElement) {
  await userEvent.click(within(row).getByRole('button', { name: /delete playlist item/i }));
  await userEvent.click(within(row).getByRole('button', { name: 'Delete' }));
}

describe('PlaylistForm', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    mockBroadcastChannels.length = 0;
    Object.defineProperty(globalThis, 'BroadcastChannel', {
      configurable: true,
      value: jest.fn().mockImplementation((name: string) => {
        const channel = { name, onmessage: null, close: jest.fn() };
        mockBroadcastChannels.push(channel);
        return channel;
      }),
    });
  });

  afterAll(() => {
    if (originalBroadcastChannel) {
      Object.defineProperty(globalThis, 'BroadcastChannel', originalBroadcastChannel);
    }
  });

  describe('when mounted with a playlist', () => {
    it('then name field should have correct value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('A test playlist');
    });

    it('then interval field should have correct value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: 'Interval' })).toHaveValue('10m');
    });

    it('then items row count should be correct', () => {
      getTestContext();

      expect(screen.getAllByRole('row')).toHaveLength(3);
    });

    it('then the first item row should be correct', () => {
      getTestContext();

      expectCorrectRow({ index: 0, type: 'dashboard_by_uid', value: 'uid_1' });
      expectCorrectRow({ index: 1, type: 'dashboard_by_uid', value: 'uid_2' });
      expectCorrectRow({ index: 2, type: 'dashboard_by_tag', value: 'tag_A' });
    });
  });

  describe('when deleting a playlist item', () => {
    it('then the item should be removed and other items should be correct', async () => {
      getTestContext();

      expect(rows()).toHaveLength(3);
      const row = rows()[2];
      await userEvent.click(within(row).getByRole('button', { name: /delete playlist item/i }));

      expect(rows()).toHaveLength(3);
      expect(within(row).getByRole('button', { name: 'Cancel' })).toHaveFocus();
      await userEvent.click(within(row).getByRole('button', { name: 'Cancel' }));
      expect(rows()).toHaveLength(3);

      await deleteItem(row);
      await waitFor(() => {
        expect(rows()).toHaveLength(2);
      });
      expectCorrectRow({ index: 0, type: 'dashboard_by_uid', value: 'uid_1' });
      expectCorrectRow({ index: 1, type: 'dashboard_by_uid', value: 'uid_2' });
    });
  });

  describe('when submitting the form', () => {
    it('then the correct item should be submitted', async () => {
      const { onSubmitMock } = getTestContext();

      await userEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
      expect(onSubmitMock).toHaveBeenCalledWith({
        apiVersion: 'playlist.grafana.app/v1',
        kind: 'Playlist',
        spec: {
          title: 'A test playlist',
          interval: '10m',
          items: [
            { type: 'dashboard_by_uid', value: 'uid_1' },
            { type: 'dashboard_by_uid', value: 'uid_2' },
            { type: 'dashboard_by_tag', value: 'tag_A' },
          ],
        },
        metadata: {
          name: 'foo',
        },
        status: {},
      });
    });

    describe('and name is missing', () => {
      it('then an alert should appear and nothing should be submitted', async () => {
        const { onSubmitMock } = getTestContext();

        await userEvent.clear(screen.getByRole('textbox', { name: /name/i }));
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(onSubmitMock).not.toHaveBeenCalled();
      });
    });

    describe('and interval is missing', () => {
      it('then an alert should appear and nothing should be submitted', async () => {
        const { onSubmitMock } = getTestContext();

        await userEvent.clear(screen.getByRole('textbox', { name: 'Interval' }));
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(onSubmitMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when items are missing', () => {
    it('then save button is disabled', async () => {
      getTestContext(mockEmptyPlaylist);

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('per-dashboard interval overrides', () => {
    it('keeps empty item options collapsed until requested', async () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: 'Interval' })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: /interval for uid_1/i })).not.toBeInTheDocument();

      const optionsButton = within(rows()[0]).getByRole('button', { name: 'Settings' });
      const settingsIcon = optionsButton.querySelector('svg');
      expect(settingsIcon).toBeInTheDocument();
      expect(settingsIcon).toHaveStyle({ pointerEvents: 'none' });
      await userEvent.hover(optionsButton);
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Settings');
      await userEvent.unhover(optionsButton);

      optionsButton.focus();
      await userEvent.keyboard('{Enter}');

      expect(optionsButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('textbox', { name: /interval for uid_1/i })).toBeInTheDocument();
      expect(within(rowForItem('uid_1')).getByText('Configure')).toBeInTheDocument();
      const moreActions = screen.getByRole('button', { name: 'More custom view actions' });
      expect(moreActions).toBeInTheDocument();

      await userEvent.click(moreActions);
      await userEvent.click(screen.getByRole('menuitem', { name: 'Paste link' }));
      expect(screen.getByRole('textbox', { name: /dashboard state for uid_1/i })).toBeInTheDocument();
    });

    it('summarizes existing options while keeping the row compact', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      // The global interval remains editable.
      expect(screen.getByRole('textbox', { name: 'Interval' })).toHaveValue('10m');
      // uid_1's override is visible as a compact summary until its options are opened.
      expect(within(rows()[0]).getByText('Custom view · Interval: 30s')).toBeInTheDocument();
      expect(within(rows()[0]).getByRole('button', { name: 'Settings' })).toHaveAttribute('aria-expanded', 'false');
      await openItemOptions('uid_1');
      expect(screen.getByRole('textbox', { name: /interval for uid_1/i })).toHaveValue('30s');

      // uid_2 inherits the global interval, so it remains compact until opened.
      await openItemOptions('uid_2');
      expect(screen.getByRole('textbox', { name: /interval for uid_2/i })).toHaveValue('');
    });

    it('submits a per-item interval override and leaves blank rows without one', async () => {
      const { onSubmitMock } = getTestContext();

      await openItemOptions('uid_1');
      await userEvent.type(screen.getByRole('textbox', { name: /interval for uid_1/i }), '30s');
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmitMock).toHaveBeenCalledTimes(1);
      expect(onSubmitMock).toHaveBeenCalledWith({
        apiVersion: 'playlist.grafana.app/v1',
        kind: 'Playlist',
        spec: {
          title: 'A test playlist',
          interval: '10m',
          items: [
            { type: 'dashboard_by_uid', value: 'uid_1', interval: '30s' },
            { type: 'dashboard_by_uid', value: 'uid_2' },
            { type: 'dashboard_by_tag', value: 'tag_A' },
          ],
        },
        metadata: {
          name: 'foo',
        },
        status: {},
      });
    });

    it('marks an unparseable per-item interval invalid and disables saving', async () => {
      getTestContext();

      await openItemOptions('uid_1');
      const input = screen.getByRole('textbox', { name: /interval for uid_1/i });
      await userEvent.type(input, 'not-an-interval');

      expect(input).toBeInvalid();
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });

    it('does not submit when Enter is pressed with an invalid per-item interval', async () => {
      const { onSubmitMock } = getTestContext();

      // Enter submits even though the disabled button can't be clicked.
      await openItemOptions('uid_1');
      await userEvent.type(screen.getByRole('textbox', { name: /interval for uid_1/i }), 'bad{Enter}');

      expect(onSubmitMock).not.toHaveBeenCalled();
    });

    it('updates the row interval placeholder when the global interval changes', async () => {
      getTestContext();

      await openItemOptions('uid_1');
      await userEvent.clear(screen.getByRole('textbox', { name: 'Interval' }));
      await userEvent.type(screen.getByRole('textbox', { name: 'Interval' }), '42s');

      expect(screen.getByRole('textbox', { name: /interval for uid_1/i })).toHaveAttribute('placeholder', '42s');
    });

    it('keeps a per-item interval with its own row after another row is removed', async () => {
      getTestContext(mockPerItemIntervalPlaylist);

      // uid_1 has 30s, uid_2 is blank. Removing uid_1 must not leave 30s on uid_2's input.
      await deleteItem(rows()[0]);
      await waitFor(() => expect(rows()).toHaveLength(1));

      await openItemOptions('uid_2');
      expect(screen.getByRole('textbox', { name: /interval for uid_2/i })).toHaveValue('');
    });

    it('clearing a per-item interval removes the override', async () => {
      const { onSubmitMock } = getTestContext(mockPerItemIntervalPlaylist);

      await openItemOptions('uid_1');
      await userEvent.clear(screen.getByRole('textbox', { name: /interval for uid_1/i }));
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmitMock).toHaveBeenCalledTimes(1);
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            interval: '10m',
            items: [
              { type: 'dashboard_by_uid', value: 'uid_1' },
              { type: 'dashboard_by_uid', value: 'uid_2' },
            ],
          }),
        })
      );
    });
  });

  describe('per-dashboard state', () => {
    it('renders the state stored on each playlist item', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      await openDashboardLinkPaste('uid_1');
      await openDashboardLinkPaste('uid_2');
      expect(screen.getByRole('textbox', { name: /dashboard state for uid_1/i })).toHaveValue(
        'var-host=host1&from=now-6h&to=now'
      );
      expect(screen.getByRole('textbox', { name: /dashboard state for uid_2/i })).toHaveValue('var-host=host2');
    });

    it('summarizes the configured view on hover and keeps secondary actions in a menu', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      await openItemOptions('uid_1');
      await userEvent.hover(within(rowForItem('uid_1')).getByText('Configured'));

      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip).toHaveTextContent('Custom view options');
      expect(tooltip).toHaveTextContent('Time range');
      expect(tooltip).toHaveTextContent('now-6h → now');
      expect(tooltip).toHaveTextContent('Variable: host');
      expect(tooltip).toHaveTextContent('host1');

      await userEvent.unhover(within(rowForItem('uid_1')).getByText('Configured'));
      await userEvent.click(within(rowForItem('uid_1')).getByRole('button', { name: 'More custom view actions' }));
      expect(screen.getByRole('menuitem', { name: 'Paste link' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Clear custom view' })).toBeInTheDocument();
    });

    it('accepts a copied dashboard URL and stores only its query string', async () => {
      const { onSubmitMock } = getTestContext();

      await openDashboardLinkPaste('uid_1');
      const dashboardState = screen.getByRole('textbox', { name: /dashboard state for uid_1/i });
      dashboardState.focus();
      await userEvent.paste('https://grafana.example.com/d/uid/name?var-host=host1&from=now-6h&to=now');

      expect(screen.queryByRole('textbox', { name: /dashboard state for uid_1/i })).not.toBeInTheDocument();
      expect(within(rowForItem('uid_1')).getByText('Configured')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                value: 'uid_1',
                queryParams: 'var-host=host1&from=now-6h&to=now',
              }),
            ]),
          }),
        })
      );
    });

    it('resolves a copied short link and stores its dashboard state', async () => {
      server.use(
        http.get('/api/short-urls/short123', () =>
          HttpResponse.json({
            uid: 'short123',
            path: '/d/uid/name?var-host=host2&from=now-12h&to=now',
          })
        )
      );
      const { onSubmitMock } = getTestContext();

      await openDashboardLinkPaste('uid_1');
      const dashboardState = screen.getByRole('textbox', { name: /dashboard state for uid_1/i });
      dashboardState.focus();
      await userEvent.paste('http://localhost:3000/goto/short123?orgId=1');

      await waitFor(() => expect(within(rowForItem('uid_1')).getByText('Configured')).toBeInTheDocument());
      await openDashboardLinkPaste('uid_1');
      expect(screen.getByRole('textbox', { name: /dashboard state for uid_1/i })).toHaveValue(
        'var-host=host2&from=now-12h&to=now'
      );
      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                value: 'uid_1',
                queryParams: 'var-host=host2&from=now-12h&to=now',
              }),
            ]),
          }),
        })
      );
    });

    it('applies a custom view configured on the dashboard', async () => {
      const { onSubmitMock } = getTestContext(mockPerItemOptionsPlaylist, [
        { name: 'uid_1', resource: 'dashboards', title: 'Dashboard one' },
      ]);

      await openItemOptions('uid_1');
      const configureLink = await screen.findByRole('link', { name: 'Configure' });
      await waitFor(() => expect(configureLink).not.toHaveAttribute('aria-disabled', 'true'));

      const configureUrl = configureLink.getAttribute('href') ?? '';
      const configureSearchParams = new URL(configureUrl, window.location.origin).searchParams;
      const token = configureSearchParams.get(PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM);
      expect(token).toBeTruthy();
      expect(configureSearchParams.get('var-host')).toBe('host1');
      expect(configureSearchParams.get('from')).toBe('now-6h');
      expect(configureSearchParams.get('to')).toBe('now');
      await userEvent.click(configureLink);
      const channel = mockBroadcastChannels[0];
      expect(channel?.name).toContain(token);
      channel?.onmessage?.(
        new MessageEvent('message', {
          data: {
            type: PLAYLIST_CUSTOM_VIEW_MESSAGE,
            token,
            queryParams: 'var-host=host3&from=now-3h&to=now',
          },
        })
      );

      await waitFor(() => expect(within(rowForItem('uid_1')).getByText('Configured')).toBeInTheDocument());
      await userEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSubmitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          spec: expect.objectContaining({
            items: expect.arrayContaining([
              expect.objectContaining({
                value: 'uid_1',
                queryParams: 'var-host=host3&from=now-3h&to=now',
              }),
            ]),
          }),
        })
      );
    });

    it('keeps parameters attached to the correct item when another row is removed', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      await deleteItem(rows()[0]);
      await waitFor(() => expect(rows()).toHaveLength(1));

      await openDashboardLinkPaste('uid_2');
      expect(screen.getByRole('textbox', { name: /dashboard state for uid_2/i })).toHaveValue('var-host=host2');
    });
  });
});

interface ExpectCorrectRowArgs {
  index: number;
  type: 'dashboard_by_tag' | 'dashboard_by_uid';
  value: string;
}

function expectCorrectRow({ index, type, value }: ExpectCorrectRowArgs) {
  const row = within(rows()[index]);
  const cell = `Playlist item, ${type}, ${value}`;
  const regex = new RegExp(cell, 'i');
  expect(row.getByRole('cell', { name: regex })).toBeInTheDocument();
}
