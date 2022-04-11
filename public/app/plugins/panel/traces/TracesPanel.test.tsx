import React from 'react';
import { render, screen } from '@testing-library/react';
import { TracesPanel } from './TracesPanel';
import { LoadingState, PanelProps } from '@grafana/data';

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
