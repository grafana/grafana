import { render, screen, fireEvent } from '@testing-library/react';
import { url } from 'inspector';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { DataTrailBookmark } from './TrailStore/TrailStore';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  getDataSource: jest.fn(() => 'Test DataSource'),
  getDataSourceName: jest.fn(() => 'Test DataSource Name'),
}));

// note: might be good to have the same tests for both trail and bookmark; OR maybe the component should be changed to just take what it needs
describe('DataTrailCard', () => {
  const trail = new DataTrail({ key: '1', metric: 'Test Recent Exploration' });
  const bookmark: DataTrailBookmark = { urlValues: { key: '1', metric: 'Test Bookmark' }, createdAt: Date.now() };
  const onSelect = jest.fn();
  const onDelete = jest.fn();
  beforeEach(() => {
    onSelect.mockClear();
    onDelete.mockClear();
  });

  it('renders the card with recent metric exploration', () => {
    render(<DataTrailCard trail={trail} onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('Test Recent Exploration')).toBeInTheDocument();
  });

  it('renders the card with bookmark', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('Test Bookmark')).toBeInTheDocument();
  });

  it('calls onSelect when the card is clicked', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Test Bookmark'));
    expect(onSelect).toHaveBeenCalled();
  });

  it('calls onDelete when the delete button is clicked', () => {
    render(<DataTrailCard bookmark={bookmark} onSelect={onSelect} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId('deleteButton'));
    expect(onDelete).toHaveBeenCalled();
  });

  // it('truncates long metric name after 2 lines', () => {
  //   const longName =
  //     'aajalsdkfaldkjfalskdjfalsdkjfalsdkjflaskjdflaskjdflaskjdflaskjdflasjkdflaskjdflaskjdflaskjflaskdjfldaskjflasjflaskdjflaskjflasjflaskfjalsdfjlskdjflaskjdflajkfjfalkdfjaverylongalskdjlalsjflajkfklsajdfalskjdflkasjdflkadjf';
  //   const bookmarkWithLongName = { urlValues: { key: '1', metric: longName }, createdAt: Date.now() };
  //   render(<DataTrailCard bookmark={bookmarkWithLongName} onSelect={onSelect} onDelete={onDelete} />);
  //   expect(screen.getByText('...', { exact: false })).toBeInTheDocument();
  // });

  it('truncates singular long label in recent explorations', () => {
    const longLabel =
      'aajalsdkfaldkjfalskdjfalsdkjfalsdkjflaskjdflaskjdflaskjdflaskjdflasjkdflaskjdflaskjdflaskjflaskdjfldaskjflasjflaskdjflaskjflasjflaskfjalsdfjlskdjflaskjdflajkfjfalkdfjaverylongalskdjlalsjflajkfklsajdfalskjdflkasjdflkadjf';
    const bookmarkWithLongLabel: DataTrailBookmark = {
      urlValues: { key: '1', metric: 'metric', 'var-filters': `zone|=|${longLabel}` },
      createdAt: Date.now(),
    };
    render(<DataTrailCard bookmark={bookmarkWithLongLabel} onSelect={onSelect} onDelete={onDelete} />);
    expect(screen.getByText('...', { exact: false })).toBeInTheDocument();
  });
});
