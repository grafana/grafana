import { render, screen } from '@testing-library/react';

import { NoData } from './NoData';

describe('NoData', () => {
  it('renders the no data message', () => {
    render(<NoData />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
