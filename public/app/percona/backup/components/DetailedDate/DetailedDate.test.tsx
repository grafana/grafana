import { render, screen } from '@testing-library/react';

import { DetailedDate } from './DetailedDate';

describe('DetailedDate', () => {
  it('should render', () => {
    render(<DetailedDate date={Date.now()} />);
    expect(screen.getByTestId('detailed-date')).toBeInTheDocument();
    expect(screen.getByTestId('detailed-date').children).toHaveLength(2);
  });
});
