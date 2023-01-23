import { render, screen } from '@testing-library/react';
import React from 'react';

import { LokiDatasource } from 'app/plugins/datasource/loki/datasource';

import { QueryOptionGroup, Props as QueryOptionProps } from './QueryOptionGroup';

describe('Query size approximation', () => {
  const _6KiB = 6144;
  const _1GiB = 1073741824;

  const props: QueryOptionProps = {
    title: 'Options',
    collapsedInfo: ['Type: Range', 'Line limit: 1000'],
    children: <div></div>,
    queryStats: { streams: 0, chunks: 0, bytes: _1GiB, entries: 0 },
    datasource: { type: 'loki' } as LokiDatasource,
  };

  it('renders the query size given 6 KiB', async () => {
    render(<QueryOptionGroup {...props} queryStats={{ streams: 0, chunks: 0, bytes: _6KiB, entries: 0 }} />);
    expect(screen.getByText(/This query will process approximately 6.0 KiB/)).toBeInTheDocument();
  });

  it('renders the query size given 1 GiB', async () => {
    render(<QueryOptionGroup {...props} />);
    expect(screen.getByText(/This query will process approximately 1.0 GiB/)).toBeInTheDocument();
  });
});
