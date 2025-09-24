import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { DataQueryError } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';

import { PanelErrorNotice } from './PanelErrorNotice';

describe('PanelErrorNotice', () => {
  const mockPanel = new VizPanel({
    title: 'Test Panel',
    key: 'panel-1',
  });

  const mockError: DataQueryError = {
    message: 'Query timeout',
    refId: 'A',
  };

  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders error notice with retry button', () => {
    render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={mockError}
        onRetry={mockOnRetry}
        frames={[]}
      />
    );

    expect(screen.getByText('Panel Error')).toBeInTheDocument();
    expect(screen.getByText('Query timeout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={mockError}
        onRetry={mockOnRetry}
        frames={[]}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('shows loading state during retry', async () => {
    render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={mockError}
        onRetry={mockOnRetry}
        frames={[]}
      />
    );

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Retrying...')).toBeInTheDocument();
    });
  });

  it('opens details drawer when details button is clicked', () => {
    render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={mockError}
        onRetry={mockOnRetry}
        frames={[]}
      />
    );

    const detailsButton = screen.getByRole('button', { name: /details/i });
    fireEvent.click(detailsButton);

    expect(screen.getByText('Error Details: Test Panel')).toBeInTheDocument();
  });

  it('shows multiple errors when present', () => {
    const framesWithErrors = [
      {
        refId: 'A',
        meta: {
          notices: [
            {
              severity: 'error' as const,
              text: 'First error',
            },
          ],
        },
        fields: [],
        length: 0,
      },
      {
        refId: 'B', 
        meta: {
          notices: [
            {
              severity: 'error' as const,
              text: 'Second error',
            },
          ],
        },
        fields: [],
        length: 0,
      },
    ];

    render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={mockError}
        onRetry={mockOnRetry}
        frames={framesWithErrors}
      />
    );

    expect(screen.getByText('Query timeout')).toBeInTheDocument();
    expect(screen.getByText('(+2 more)')).toBeInTheDocument();
  });

  it('returns null when no errors present', () => {
    const { container } = render(
      <PanelErrorNotice 
        panel={mockPanel}
        error={undefined}
        onRetry={mockOnRetry}
        frames={[]}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});