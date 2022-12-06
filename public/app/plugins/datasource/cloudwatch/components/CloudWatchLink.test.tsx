import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import { CloudWatchLogsQuery } from '../types';

import CloudWatchLink from './CloudWatchLink';

describe('CloudWatchLink', () => {
  it('generates a link', async () => {
    const ds = setupMockedDataSource();

    render(<CloudWatchLink query={{} as CloudWatchLogsQuery} datasource={ds.datasource} />);

    await waitFor(() => {
      expect(screen.getByText('CloudWatch Logs Insights').closest('a')).toHaveAttribute(
        'href',
        'https://www.test.com/'
      );
    });
  });
});
