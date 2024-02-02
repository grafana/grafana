import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { promQueryModeller } from './PromQueryModeller';
import { QueryPatternsModal } from './QueryPatternsModal';
import { PromQueryPatternType } from './types';

// don't care about interaction tracking in our unit tests
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  onChange: jest.fn(),
  onAddQuery: jest.fn(),
  query: {
    refId: 'A',
    expr: 'sum(rate({job="grafana"}[$__rate_interval]))',
  },
  queries: [
    {
      refId: 'A',
      expr: 'go_goroutines{instance="localhost:9090"}',
    },
  ],
};

const queryPatterns = {
  rateQueryPatterns: promQueryModeller
    .getQueryPatterns()
    .filter((pattern) => pattern.type === PromQueryPatternType.Rate),
  histogramQueryPatterns: promQueryModeller
    .getQueryPatterns()
    .filter((pattern) => pattern.type === PromQueryPatternType.Histogram),
  binaryQueryPatterns: promQueryModeller
    .getQueryPatterns()
    .filter((pattern) => pattern.type === PromQueryPatternType.Binary),
};

describe('QueryPatternsModal', () => {
  it('renders the modal', () => {
    render(<QueryPatternsModal {...defaultProps} />);
    expect(screen.getByText('Kick start your query')).toBeInTheDocument();
  });
  it('renders collapsible elements with all query pattern types', () => {
    render(<QueryPatternsModal {...defaultProps} />);
    Object.values(PromQueryPatternType).forEach((pattern) => {
      expect(screen.getByText(new RegExp(`${pattern} query starters`, 'i'))).toBeInTheDocument();
    });
  });
  it('can open and close query patterns section', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.queryByText(queryPatterns.rateQueryPatterns[0].name)).not.toBeInTheDocument();
  });

  it('can open and close multiple query patterns section', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Histogram query starters'));
    expect(screen.getByText(queryPatterns.histogramQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.queryByText(queryPatterns.rateQueryPatterns[0].name)).not.toBeInTheDocument();

    // Histogram patterns should still be open
    expect(screen.getByText(queryPatterns.histogramQueryPatterns[0].name)).toBeInTheDocument();
  });

  it('uses pattern if there is no existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} query={{ expr: '', refId: 'A' }} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'use this query button' })[0];
    await userEvent.click(firstUseQueryButton);
    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith({
        expr: 'sum(rate([$__rate_interval]))',
        refId: 'A',
      });
    });
  });

  it('gives warning when selecting pattern if there are already existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'use this query button' })[0];
    await userEvent.click(firstUseQueryButton);

    expect(screen.getByText(/you can either apply this query pattern or create a new query/)).toBeInTheDocument();
  });

  it('can use create new query when selecting pattern if there is already existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'use this query button' })[0];
    await userEvent.click(firstUseQueryButton);
    const createNewQueryButton = screen.getByRole('button', { name: 'create new query button' });
    expect(createNewQueryButton).toBeInTheDocument();
    await userEvent.click(createNewQueryButton);
    await waitFor(() => {
      expect(defaultProps.onAddQuery).toHaveBeenCalledWith({
        expr: 'sum(rate([$__rate_interval]))',
        refId: 'B',
      });
    });
  });

  it('does not show create new query option if onAddQuery function is not provided ', async () => {
    render(<QueryPatternsModal {...defaultProps} onAddQuery={undefined} />);
    await userEvent.click(screen.getByText('Rate query starters'));
    expect(screen.getByText(queryPatterns.rateQueryPatterns[0].name)).toBeInTheDocument();
    const useQueryButton = screen.getAllByRole('button', { name: 'use this query button' })[0];
    await userEvent.click(useQueryButton);
    expect(screen.queryByRole('button', { name: 'Create new query' })).not.toBeInTheDocument();
    expect(screen.getByText(/this query pattern will be applied to your current query/)).toBeInTheDocument();
  });

  it('applies binary query patterns to query', async () => {
    render(<QueryPatternsModal {...defaultProps} query={{ expr: '', refId: 'A' }} />);
    await userEvent.click(screen.getByText('Binary query starters'));
    expect(screen.getByText(queryPatterns.binaryQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'use this query button' })[0];
    await userEvent.click(firstUseQueryButton);
    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith({
        expr: 'sum(rate([$__rate_interval])) / sum(rate([$__rate_interval]))',
        refId: 'A',
      });
    });
  });
});
