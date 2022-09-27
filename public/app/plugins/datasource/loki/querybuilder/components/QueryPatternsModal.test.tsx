import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { lokiQueryModeller } from '../LokiQueryModeller';
import { LokiQueryPatternType } from '../types';

import { QueryPatternsModal } from './QueryPatternsModal';

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
    expr: '{label1="foo", label2="bar"} |= "baz" |~ "qux"',
  },
  queries: [
    {
      refId: 'A',
      expr: '{label1="foo", label2="bar"}',
    },
  ],
};

const queryPatterns = {
  logQueryPatterns: lokiQueryModeller.getQueryPatterns().filter((pattern) => pattern.type === LokiQueryPatternType.Log),
  metricQueryPatterns: lokiQueryModeller
    .getQueryPatterns()
    .filter((pattern) => pattern.type === LokiQueryPatternType.Metric),
};

describe('QueryPatternsModal', () => {
  it('renders the modal', () => {
    render(<QueryPatternsModal {...defaultProps} />);
    expect(screen.getByText('Kick start your query')).toBeInTheDocument();
  });
  it('renders collapsible elements with all query pattern types', () => {
    render(<QueryPatternsModal {...defaultProps} />);
    Object.values(LokiQueryPatternType).forEach((pattern) => {
      expect(screen.getByText(new RegExp(`${pattern} query starters`, 'i'))).toBeInTheDocument();
    });
  });
  it('can open and close query patterns section', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.queryByText(queryPatterns.logQueryPatterns[0].name)).not.toBeInTheDocument();
  });

  it('can open and close multiple query patterns section', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Metric query starters'));
    expect(screen.getByText(queryPatterns.metricQueryPatterns[0].name)).toBeInTheDocument();

    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.queryByText(queryPatterns.logQueryPatterns[0].name)).not.toBeInTheDocument();

    // Metric patterns should still be open
    expect(screen.getByText(queryPatterns.metricQueryPatterns[0].name)).toBeInTheDocument();
  });

  it('uses pattern if there is no existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} query={{ expr: '{job="grafana"}', refId: 'A' }} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
    await userEvent.click(firstUseQueryButton);
    await waitFor(() => {
      expect(defaultProps.onChange).toHaveBeenCalledWith({
        expr: '{job="grafana"} | logfmt | __error__=``',
        refId: 'A',
      });
    });
  });

  it('gives warning when selecting pattern if there is already existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
    await userEvent.click(firstUseQueryButton);
    expect(screen.getByText(/replace your current query or create a new query/)).toBeInTheDocument();
  });

  it('can use create new query when selecting pattern if there is already existing query', async () => {
    render(<QueryPatternsModal {...defaultProps} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
    const firstUseQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
    await userEvent.click(firstUseQueryButton);
    const createNewQueryButton = screen.getByRole('button', { name: 'Create new query' });
    expect(createNewQueryButton).toBeInTheDocument();
    await userEvent.click(createNewQueryButton);
    await waitFor(() => {
      expect(defaultProps.onAddQuery).toHaveBeenCalledWith({
        expr: '{} | logfmt | __error__=``',
        refId: 'B',
      });
    });
  });

  it('does not show create new query option if onAddQuery function is not provided ', async () => {
    render(<QueryPatternsModal {...defaultProps} onAddQuery={undefined} />);
    await userEvent.click(screen.getByText('Log query starters'));
    expect(screen.getByText(queryPatterns.logQueryPatterns[0].name)).toBeInTheDocument();
    const useQueryButton = screen.getAllByRole('button', { name: 'Use this query' })[0];
    await userEvent.click(useQueryButton);
    expect(screen.queryByRole('button', { name: 'Create new query' })).not.toBeInTheDocument();
    expect(screen.getByText(/your current query will be replaced/)).toBeInTheDocument();
  });
});
