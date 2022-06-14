import { within } from '@testing-library/dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { PlaylistForm } from './PlaylistForm';
import { Playlist } from './types';

jest.mock('../../core/components/TagFilter/TagFilter', () => ({
  TagFilter: () => {
    return <>mocked-tag-filter</>;
  },
}));

function getTestContext({ name, interval, items, uid }: Partial<Playlist> = {}) {
  const onSubmitMock = jest.fn();
  const playlist = { name, items, interval, uid } as unknown as Playlist;
  const { rerender } = render(<PlaylistForm onSubmit={onSubmitMock} playlist={playlist} />);

  return { onSubmitMock, playlist, rerender };
}

const playlist: Playlist = {
  name: 'A test playlist',
  interval: '10m',
  items: [
    { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
    { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
    { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
  ],
  uid: 'foo',
};

function rows() {
  return screen.getAllByRole('row', { name: /playlist item row/i });
}

describe('PlaylistForm', () => {
  describe('when mounted without playlist', () => {
    it('then it should contain name and interval fields', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /playlist name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /playlist interval/i })).toBeInTheDocument();
      expect(screen.queryByRole('row', { name: /playlist item row/i })).not.toBeInTheDocument();
    });

    it('then name field should have empty string as default value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('');
    });

    it('then interval field should have 5m as default value', () => {
      getTestContext();

      expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('5m');
    });
  });

  describe('when mounted with a playlist', () => {
    it('then name field should have correct value', () => {
      getTestContext(playlist);

      expect(screen.getByRole('textbox', { name: /playlist name/i })).toHaveValue('A test playlist');
    });

    it('then interval field should have correct value', () => {
      getTestContext(playlist);

      expect(screen.getByRole('textbox', { name: /playlist interval/i })).toHaveValue('10m');
    });

    it('then items row count should be correct', () => {
      getTestContext(playlist);

      expect(screen.getAllByRole('row', { name: /playlist item row/i })).toHaveLength(3);
    });

    it('then the first item row should be correct', () => {
      getTestContext(playlist);

      expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
    });

    it('then the middle item row should be correct', () => {
      getTestContext(playlist);

      expectCorrectRow({ index: 1, type: 'id', title: 'middle item' });
    });

    it('then the last item row should be correct', () => {
      getTestContext(playlist);

      expectCorrectRow({ index: 2, type: 'tag', title: 'last item', last: true });
    });
  });

  describe('when deleting a playlist item', () => {
    it('then the item should be removed and other items should be correct', async () => {
      getTestContext(playlist);

      expect(rows()).toHaveLength(3);
      await userEvent.click(within(rows()[2]).getByRole('button', { name: /delete playlist item/i }));
      expect(rows()).toHaveLength(2);
      expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
      expectCorrectRow({ index: 1, type: 'id', title: 'middle item', last: true });
    });
  });

  describe('when moving a playlist item up', () => {
    it('then the item should be removed and other items should be correct', async () => {
      getTestContext(playlist);

      await userEvent.click(within(rows()[2]).getByRole('button', { name: /move playlist item order up/i }));
      expectCorrectRow({ index: 0, type: 'id', title: 'first item', first: true });
      expectCorrectRow({ index: 1, type: 'tag', title: 'last item' });
      expectCorrectRow({ index: 2, type: 'id', title: 'middle item', last: true });
    });
  });

  describe('when moving a playlist item down', () => {
    it('then the item should be removed and other items should be correct', async () => {
      getTestContext(playlist);

      await userEvent.click(within(rows()[0]).getByRole('button', { name: /move playlist item order down/i }));
      expectCorrectRow({ index: 0, type: 'id', title: 'middle item', first: true });
      expectCorrectRow({ index: 1, type: 'id', title: 'first item' });
      expectCorrectRow({ index: 2, type: 'tag', title: 'last item', last: true });
    });
  });

  describe('when submitting the form', () => {
    it('then the correct item should be submitted', async () => {
      const { onSubmitMock } = getTestContext(playlist);

      await userEvent.click(screen.getByRole('button', { name: /save/i }));
      expect(onSubmitMock).toHaveBeenCalledTimes(1);
      expect(onSubmitMock).toHaveBeenCalledWith({
        name: 'A test playlist',
        interval: '10m',
        items: [
          { title: 'First item', type: 'dashboard_by_id', order: 1, value: '1' },
          { title: 'Middle item', type: 'dashboard_by_id', order: 2, value: '2' },
          { title: 'Last item', type: 'dashboard_by_tag', order: 2, value: 'Last item' },
        ],
      });
    });

    describe('and name is missing', () => {
      it('then an alert should appear and nothing should be submitted', async () => {
        const { onSubmitMock } = getTestContext({ ...playlist, name: undefined });

        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(onSubmitMock).not.toHaveBeenCalled();
      });
    });

    describe('and interval is missing', () => {
      it('then an alert should appear and nothing should be submitted', async () => {
        const { onSubmitMock } = getTestContext(playlist);

        await userEvent.clear(screen.getByRole('textbox', { name: /playlist interval/i }));
        await userEvent.click(screen.getByRole('button', { name: /save/i }));
        expect(screen.getAllByRole('alert')).toHaveLength(1);
        expect(onSubmitMock).not.toHaveBeenCalled();
      });
    });
  });

  describe('when items are missing', () => {
    it('then save button is disabled', async () => {
      getTestContext({ ...playlist, items: [] });

      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });
});

interface ExpectCorrectRowArgs {
  index: number;
  type: 'id' | 'tag';
  title: string;
  first?: boolean;
  last?: boolean;
}

function expectCorrectRow({ index, type, title, first = false, last = false }: ExpectCorrectRowArgs) {
  const row = within(rows()[index]);
  const cell = `playlist item dashboard by ${type} type ${title}`;
  const regex = new RegExp(cell, 'i');
  expect(row.getByRole('cell', { name: regex })).toBeInTheDocument();
  if (first) {
    expect(row.queryByRole('button', { name: /move playlist item order up/i })).not.toBeInTheDocument();
  } else {
    expect(row.getByRole('button', { name: /move playlist item order up/i })).toBeInTheDocument();
  }

  if (last) {
    expect(row.queryByRole('button', { name: /move playlist item order down/i })).not.toBeInTheDocument();
  } else {
    expect(row.getByRole('button', { name: /move playlist item order down/i })).toBeInTheDocument();
  }

  expect(row.getByRole('button', { name: /delete playlist item/i })).toBeInTheDocument();
}
