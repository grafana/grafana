import { render, screen } from '@testing-library/react';
import React from 'react';

import { LoadingState, PanelProps } from '@grafana/data';

import { TracesPanel } from './TracesPanel';

describe('TracesPanel', () => {
  it('shows no data message when no data supplied', async () => {
    const props = {
      data: {
        error: undefined,
        series: [],
        state: LoadingState.Done,
      },
    } as unknown as PanelProps;

    render(<TracesPanel {...props} />);

    await screen.findByText('No data found in response');
  });
});
