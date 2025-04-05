import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Playlist } from '../../api/clients/playlist';

import { PlaylistForm } from './PlaylistForm';

jest.mock('app/core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

const mockPlaylist: Playlist = {
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

const mockEmptyPlaylist: Playlist = {
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
  const onSubmitMock = jest.fn();
  const { rerender } = render(<PlaylistForm onSubmit={onSubmitMock} playlist={playlist} />);

  return { onSubmitMock, playlist, rerender };
}

function rows() {
  return screen.getAllByRole('row');
}

describe('PlaylistForm', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('when mounted with a playlist', () => {
    it('then name field should have correct value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('A test playlist');
    });

    it('then interval field should have correct value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('10m');
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
      expect(rows()).toHaveLength(2);
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

        await userEvent.clear(screen.getByRole('textbox', { name: /playlist name/i }));
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(onSubmitMock).not.toHaveBeenCalled();
      });
    });

    describe('and interval is missing', () => {
      it('then an alert should appear and nothing should be submitted', async () => {
        const { onSubmitMock } = getTestContext();

        await userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
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
