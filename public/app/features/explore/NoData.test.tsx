import { screen } from '@testing-library/react';

import { render } from '../../../test/test-utils';

import { NoData } from './NoData';

describe('NoData', () => {
  it('should render "No data" message', () => {
    render(<NoData />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('should have the correct test id', () => {
    render(<NoData />);
    expect(screen.getByTestId('explore-no-data')).toBeInTheDocument();
  });
});
