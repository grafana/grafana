import { act } from 'react';
import { Subject } from 'rxjs';
import { render, screen, waitFor } from 'test/test-utils';

import { mockComboboxRect } from '@grafana/test-utils';

import { MediaType, ResourceFolderName } from '../types';

import { FolderPickerTab } from './FolderPickerTab';

// Mock ResourceCards so we can assert on the cards passed to it. The real component renders
// into a react-window grid wrapped in AutoSizer, which has no size in jsdom and renders nothing.
jest.mock('./ResourceCards', () => ({
  ResourceCards: ({
    cards,
    onChange,
  }: {
    cards: Array<{ value: string; label: string }>;
    onChange: (v: string) => void;
  }) => (
    <div data-testid="resource-cards">
      {cards.map((card) => (
        <button key={card.value} onClick={() => onChange(card.value)}>
          {card.label}
        </button>
      ))}
    </div>
  ),
}));

// Each listFiles(folder) call gets its own Subject so tests can emit results per folder on demand,
// including emitting on a previous folder's request after the user has switched folders.
const listFilesSubjects = new Map<string, Subject<unknown>>();
const mockListFiles = jest.fn((folder: string) => {
  const subject = new Subject<unknown>();
  listFilesSubjects.set(folder, subject);
  return subject;
});

jest.mock('app/plugins/datasource/grafana/datasource', () => ({
  ...jest.requireActual('app/plugins/datasource/grafana/datasource'),
  getGrafanaDatasource: () => Promise.resolve({ listFiles: mockListFiles }),
}));

interface FileLike {
  name: string;
}

// Mimics the DataFrameView passed to the subscriber: the component only relies on forEach.
const makeFrame = (names: string[]) => ({
  forEach: (cb: (item: FileLike) => void) => names.forEach((name) => cb({ name })),
});

const emitFolderFiles = (folder: string, names: string[]) => {
  const subject = listFilesSubjects.get(folder);
  if (!subject) {
    throw new Error(`No listFiles subscription for folder "${folder}"`);
  }
  act(() => {
    subject.next(makeFrame(names));
  });
};

const renderTab = (props: Partial<React.ComponentProps<typeof FolderPickerTab>> = {}) =>
  render(
    <FolderPickerTab
      mediaType={MediaType.Icon}
      folderName={ResourceFolderName.Icon}
      newValue=""
      setNewValue={jest.fn()}
      {...props}
    />
  );

beforeEach(() => {
  mockComboboxRect();
  listFilesSubjects.clear();
  mockListFiles.mockClear();
});

describe('FolderPickerTab', () => {
  it('loads files for the initial folder and only shows icons matching the media type', async () => {
    renderTab({ mediaType: MediaType.Icon });

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Icon, undefined));

    emitFolderFiles(ResourceFolderName.Icon, ['plus.svg', 'minus.svg', 'photo.png', 'anim.gif']);

    expect(await screen.findByRole('button', { name: 'plus.svg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'minus.svg' })).toBeInTheDocument();
    // png/gif are images, not icons, so they are filtered out
    expect(screen.queryByRole('button', { name: 'photo.png' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'anim.gif' })).not.toBeInTheDocument();
  });

  it('shows png/gif and filters out svg when the media type is an image', async () => {
    renderTab({ mediaType: MediaType.Image, folderName: ResourceFolderName.BG });

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.BG, undefined));

    emitFolderFiles(ResourceFolderName.BG, ['photo.png', 'anim.gif', 'icon.svg']);

    expect(await screen.findByRole('button', { name: 'photo.png' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'anim.gif' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'icon.svg' })).not.toBeInTheDocument();
  });

  it('forwards maxFiles to listFiles', async () => {
    renderTab({ maxFiles: 1500 });

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Icon, 1500));
  });

  it('filters the displayed cards by the search query', async () => {
    const { user } = renderTab();

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Icon, undefined));
    emitFolderFiles(ResourceFolderName.Icon, ['plus.svg', 'minus.svg']);

    expect(await screen.findByRole('button', { name: 'plus.svg' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search'), 'plus');

    expect(screen.getByRole('button', { name: 'plus.svg' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'minus.svg' })).not.toBeInTheDocument();
  });

  it('clears the grid immediately when switching folders and loads the new folder', async () => {
    const { user } = renderTab();

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Icon, undefined));
    emitFolderFiles(ResourceFolderName.Icon, ['plus.svg']);
    expect(await screen.findByRole('button', { name: 'plus.svg' })).toBeInTheDocument();

    // Switch to the IOT folder
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: ResourceFolderName.IOT }));

    // The previous folder's icons must be gone before the new folder's request resolves
    expect(screen.queryByRole('button', { name: 'plus.svg' })).not.toBeInTheDocument();

    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.IOT, undefined));
    emitFolderFiles(ResourceFolderName.IOT, ['sensor.svg']);

    expect(await screen.findByRole('button', { name: 'sensor.svg' })).toBeInTheDocument();
  });

  it('ignores a stale previous-folder response that arrives after switching folders', async () => {
    const { user } = renderTab();

    // The initial folder's request is in flight but has not responded yet (slow request)
    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.Icon, undefined));

    // Switch folders before the first request responds
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: ResourceFolderName.IOT }));
    await waitFor(() => expect(mockListFiles).toHaveBeenCalledWith(ResourceFolderName.IOT, undefined));

    // The slow first-folder request finally responds — its results must be discarded
    emitFolderFiles(ResourceFolderName.Icon, ['plus.svg']);
    expect(screen.queryByRole('button', { name: 'plus.svg' })).not.toBeInTheDocument();

    // The current folder's response still populates the grid
    emitFolderFiles(ResourceFolderName.IOT, ['sensor.svg']);
    expect(await screen.findByRole('button', { name: 'sensor.svg' })).toBeInTheDocument();
  });
});
