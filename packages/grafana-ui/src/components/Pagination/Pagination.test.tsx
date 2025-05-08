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
});
