import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrailsBookmarks } from './DataTrailBookmarks';
import { getTrailStore, getBookmarkKey, DataTrailBookmark } from './TrailStore/TrailStore';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
  getBookmarkKey: jest.fn(() => 'bookmark-key'),
}));

const onSelect = jest.fn();
const onDelete = jest.fn();

describe('DataTrailsBookmarks', () => {
  beforeEach(() => {
    onSelect.mockClear();
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [],
      recent: [],
      getTrailForBookmark: jest.fn(),
    }));
  });

  it('does not render if there are no bookmarks', () => {
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.queryByText('Or view bookmarks')).not.toBeInTheDocument();
  });

  it('renders the bookmarks header and toggle button', () => {
    console.warn = jest.fn();
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [{}, {}, {}],
      recent: [],
    }));
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('Or view bookmarks')).toBeInTheDocument();
    expect(screen.getByLabelText('bookmarkCarrot')).toBeInTheDocument();
  });

  it('toggles the bookmark list when the toggle button is clicked', () => {
    console.warn = jest.fn();
    const bookmark: DataTrailBookmark = { urlValues: { key: '1', metric: 'Test Bookmark' }, createdAt: Date.now() };
    (getTrailStore as jest.Mock).mockImplementation(() => ({
      bookmarks: [bookmark],
      recent: [],
      getTrailForBookmark: jest.fn(),
    }));
    render(<DataTrailsBookmarks onSelect={onSelect} onDelete={onDelete} />);
    const button = screen.getByLabelText('bookmarkCarrot');
    fireEvent.click(button);
    expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText('Test Bookmark')).not.toBeInTheDocument();
  });

  it('calls onDelete when the delete button is clicked', () => {
    getTrailStore.mockReturnValue({
      bookmarks: [{}, {}, {}],
    });
    render(<DataTrailsBookmarks model={model} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('bookmarkCarrot'));
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });
});
