import { render, screen } from '@testing-library/react';
import React from 'react';

import { QueryOptionGroup, Props } from './QueryOptionGroup';

describe('Query size approximation', () => {
  const _1KiB = 1024; // size of 1 KiB in bytes
  const _1GiB = 1073741824; // ...
  const _1PiB = 1125899906842624;

  it('renders the correct data value given 1 KiB', async () => {
    const props = createProps(_1KiB);
    render(<QueryOptionGroup {...props} />);
    expect(screen.getByText(/This query will process approximately 1.0 KiB/)).toBeInTheDocument();
  });

  it('renders the correct data value given 1 GiB', async () => {
    const props = createProps(_1GiB);
    render(<QueryOptionGroup {...props} />);
    expect(screen.getByText(/This query will process approximately 1.0 GiB/)).toBeInTheDocument();
  });

  it('renders the correct data value given 1 PiB', async () => {
    const props = createProps(_1PiB);
    render(<QueryOptionGroup {...props} />);
    expect(screen.getByText(/This query will process approximately 1.0 PiB/)).toBeInTheDocument();
  });

  it('updates the data value on data change', async () => {
    const props1 = createProps(_1KiB);
    const props2 = createProps(_1PiB);

    const { rerender } = render(<QueryOptionGroup {...props1} />);
    expect(screen.getByText(/This query will process approximately 1.0 KiB/)).toBeInTheDocument();

    rerender(<QueryOptionGroup {...props2} />);
    expect(screen.getByText(/This query will process approximately 1.0 PiB/)).toBeInTheDocument();
  });
});

function createProps(bytes?: number): Props {
  return {
    title: 'Options',
    collapsedInfo: ['Type: Range', 'Line limit: 1000'],
    children: <div></div>,
    queryStats: { streams: 0, chunks: 0, bytes: bytes ?? 0, entries: 0 },
  };
}
