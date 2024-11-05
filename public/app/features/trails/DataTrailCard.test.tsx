import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrailCard } from './DataTrailCard';

describe('DataTrailCard', () => {
  const bookmark = { title: 'Test Bookmark', description: 'Test Description' };
  const onSelect = jest.fn();
  const onDelete = jest.fn();

  it('renders the card with title and description', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  it('calls onSelect when the card is clicked', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Test Bookmark'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls onDelete when the delete button is clicked', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText('Delete'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('truncates long labels in the card', () => {
    const longLabel = 'This is a very long label that should be truncated';
    const bookmarkWithLongLabel = { title: longLabel, description: 'Test Description' };
    render(<DataTrailCard bookmark={bookmarkWithLongLabel} onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText(longLabel)).toHaveClass('truncate');
  });
});
