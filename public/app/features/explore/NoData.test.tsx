import { render, screen } from '@testing-library/react';

import { NoData } from './NoData';

describe('NoData', () => {
  it('renders correctly with "No data" text', () => {
    render(<NoData />);

    expect(screen.getByTestId('explore-no-data')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
