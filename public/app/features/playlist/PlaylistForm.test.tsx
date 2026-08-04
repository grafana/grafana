import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';

import { type Playlist } from '../../api/clients/playlist/v1';
import { backendSrv } from '../../core/services/backend_srv';

import { PlaylistForm } from './PlaylistForm';

setBackendSrv(backendSrv);
setupMockServer();

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

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

function getTestContext(playlist: Playlist = mockPlaylist) {
  server.use(getCustomSearchHandler([]));
  const onSubmitMock = jest.fn();
  const { rerender } = render(<PlaylistForm onSubmit={onSubmitMock} playlist={playlist} />);

  return { onSubmitMock, playlist, rerender };
}

function rows() {
  return screen.getAllByRole('row');
}

async function openItemOptions(itemValue: string) {
  const button = screen.getByRole('button', { name: `Settings for ${itemValue}` });
  if (button.getAttribute('aria-expanded') === 'false') {
    await userEvent.click(button);
  }
}

describe('PlaylistForm', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
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
      await userEvent.click(within(rows()[2]).getByRole('button', { name: /delete playlist item/i }));
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

      const optionsButton = screen.getByRole('button', { name: 'Settings for uid_1' });
      optionsButton.focus();
      await userEvent.keyboard('{Enter}');

      expect(optionsButton).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('textbox', { name: /interval for uid_1/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /url parameters for uid_1/i })).toBeInTheDocument();
    });

    it('summarizes existing options while keeping the row compact', async () => {
      getTestContext(mockPerItemIntervalPlaylist);

      // The global interval remains editable.
      expect(screen.getByRole('textbox', { name: 'Interval' })).toHaveValue('10m');
      // uid_1's override is visible as a compact summary until its options are opened.
      expect(within(rows()[0]).getByText('30s')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Settings for uid_1' })).toHaveAttribute('aria-expanded', 'false');
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
      await userEvent.click(within(rows()[0]).getByRole('button', { name: /delete playlist item/i }));
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

  describe('per-dashboard URL parameters', () => {
    it('renders the parameters stored on each playlist item', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      await openItemOptions('uid_1');
      await openItemOptions('uid_2');
      expect(screen.getByRole('textbox', { name: /url parameters for uid_1/i })).toHaveValue(
        'var-host=host1&from=now-6h&to=now'
      );
      expect(screen.getByRole('textbox', { name: /url parameters for uid_2/i })).toHaveValue('var-host=host2');
    });

    it('accepts a copied dashboard URL and stores only its query string', async () => {
      const { onSubmitMock } = getTestContext();

      await openItemOptions('uid_1');
      await userEvent.type(
        screen.getByRole('textbox', { name: /url parameters for uid_1/i }),
        'https://grafana.example.com/d/uid/name?var-host=host1&from=now-6h&to=now'
      );
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

    it('keeps parameters attached to the correct item when another row is removed', async () => {
      getTestContext(mockPerItemOptionsPlaylist);

      await userEvent.click(within(rows()[0]).getByRole('button', { name: /delete playlist item/i }));
      await waitFor(() => expect(rows()).toHaveLength(1));

      await openItemOptions('uid_2');
      expect(screen.getByRole('textbox', { name: /url parameters for uid_2/i })).toHaveValue('var-host=host2');
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
