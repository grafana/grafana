import { render, screen } from '@testing-library/react';

import { Pagination } from './Pagination';

describe('Pagination component', () => {
  it('should render only 10 buttons when number of pages is higher than 8', () => {
    render(<Pagination currentPage={1} numberOfPages={90} onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(10);
  });
  it('should only show 3 buttons when showSmallVersion is true', () => {
    render(<Pagination currentPage={1} numberOfPages={90} onNavigate={() => {}} showSmallVersion />);
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
  it('should render two ellipsis when there are more than 14 page and a middle page is selected', () => {
    render(<Pagination currentPage={8} numberOfPages={15} onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    expect(screen.getAllByTestId('pagination-ellipsis-icon')).toHaveLength(2);
  });
  it('should only render the page number if number of pages is 0', () => {
    render(<Pagination currentPage={8} numberOfPages={0} onNavigate={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button')[1]).toBeEnabled();
    expect(screen.getByText('8')).toBeVisible();
  });
  it('should disable the next page button if hasNextPage is false', () => {
    render(<Pagination currentPage={8} numberOfPages={0} onNavigate={() => {}} hasNextPage={false} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getAllByRole('button')[0]).toBeEnabled();
    expect(screen.getAllByRole('button')[1]).toBeDisabled();
  });
});
