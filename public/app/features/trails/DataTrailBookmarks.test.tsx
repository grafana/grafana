import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrailsBookmarks } from './DataTrailBookmarks';
import { getTrailStore, getBookmarkKey } from './TrailStore/TrailStore';

jest.mock('./TrailStore/TrailStore', () => ({
  getTrailStore: jest.fn(),
  getBookmarkKey: jest.fn(() => 'bookmark-key'),
}));

describe('DataTrailsBookmarks', () => {
  const onDelete = jest.fn();
  const model = { onSelectBookmark: jest.fn() };

  beforeEach(() => {
    getTrailStore.mockReturnValue({
      bookmarks: [],
    });
  });

  it('does not render if there are no bookmarks', () => {
    render(<DataTrailsBookmarks model={model} onDelete={onDelete} />);
    expect(screen.queryByText('Or view bookmarks')).not.toBeInTheDocument();
  });

  it('renders the bookmarks header and toggle button', () => {
    getTrailStore.mockReturnValue({
      bookmarks: [{}, {}, {}],
    });
    render(<DataTrailsBookmarks model={model} onDelete={onDelete} />);
    expect(screen.getByText('Or view bookmarks')).toBeInTheDocument();
    expect(screen.getByLabelText('bookmarkCarrot')).toBeInTheDocument();
  });

  it('toggles the bookmark list when the toggle button is clicked', () => {
    getTrailStore.mockReturnValue({
      bookmarks: [{}, {}, {}],
    });
    render(<DataTrailsBookmarks model={model} onDelete={onDelete} />);
    const button = screen.getByLabelText('bookmarkCarrot');
    fireEvent.click(button);
    expect(screen.getByText('bookmark-key')).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByText('bookmark-key')).not.toBeInTheDocument();
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

  it('selecting a bookmark card takes you to the metric', () => {
    const onSelectBookmark = jest.fn();
    getTrailStore.mockReturnValue({
      bookmarks: [{ resolve: () => ({ state: { key: '1' }, onSelectBookmark }) }],
    });
    render(<DataTrailsBookmarks model={model} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('bookmarkCarrot'));
    fireEvent.click(screen.getByText('1'));
    expect(onSelectBookmark).toHaveBeenCalled();
  });
});
