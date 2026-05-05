import { render, screen, waitFor } from '@testing-library/react';

import { DataLinkInput } from './DataLinkInput';

describe('DataLinkInput', () => {
  it('renders with default placeholder', async () => {
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={[]} />);

    await waitFor(() => {
      expect(screen.getByText('http://your-grafana.com/d/000000010/annotations')).toBeInTheDocument();
    });
  });

  it('renders with custom placeholder', async () => {
    render(<DataLinkInput value="" onChange={jest.fn()} suggestions={[]} placeholder="Enter URL" />);

    await waitFor(() => {
      expect(screen.getByText('Enter URL')).toBeInTheDocument();
    });
  });

  it('renders with initial value', async () => {
    render(<DataLinkInput value="http://example.com" onChange={jest.fn()} suggestions={[]} />);

    await waitFor(() => {
      expect(screen.getByText('http://example.com')).toBeInTheDocument();
    });
  });
});
