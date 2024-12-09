import { render, screen, fireEvent } from '@testing-library/react';

import { DataTrail } from './DataTrail';
import { DataTrailCard } from './DataTrailCard';
import { DataTrailBookmark } from './TrailStore/TrailStore';

jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
}));

describe('DataTrailCard', () => {
  // trail is a recent metric exploration
  const trail = new DataTrail({ key: '1', metric: 'Test Recent Exploration' });
  // bookmark is a data trail stored in a url
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

  it('truncates long list of labels after 2 lines in recent explorations', () => {
    const bookmarkWithLongLabel: DataTrailBookmark = {
      urlValues: {
        key: '1',
        metric: 'metric',
        // labels are in a comma separated list
        'var-filters': `zone|=|averylonglabeltotakeupspace,zone1=averylonglabeltotakeupspace,zone2=averylonglabeltotakeupspace,zone3=averylonglabeltotakeupspace,zone4=averylonglabeltotakeupspace`,
      },
      createdAt: Date.now(),
    };
    render(<DataTrailCard bookmark={bookmarkWithLongLabel} onSelect={onSelect} onDelete={onDelete} />);
    // to test the non-existence of a truncated label we need queryByText
    const truncatedLabel = screen.queryByText('zone3');
    expect(truncatedLabel).not.toBeInTheDocument();
  });
});
