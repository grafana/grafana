import { render, screen } from '@testing-library/react';

import { PageFallbackLoader } from './PageFallbackLoader';

describe('PageFallbackLoader', () => {
  it('renders the active step', () => {
    render(<PageFallbackLoader />);

    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.getByText('Fetching data')).toBeInTheDocument();
  });
});
