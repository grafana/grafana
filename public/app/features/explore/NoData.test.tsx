import { render, screen } from '@testing-library/react';

import { NoData } from './NoData';

describe('NoData', () => {
  it('renders without error', () => {
    render(<NoData />);
    expect(screen.getByTestId('explore-no-data')).toBeInTheDocument();
  });
});
